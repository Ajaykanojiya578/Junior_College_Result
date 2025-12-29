# backend/routes/teacher_routes.py

from flask import Blueprint, request, jsonify

from app import db
from typing import Any, Dict, cast
from models import (
    Student,
    Subject,
    Mark,
    TeacherSubjectAllocation
)
from services.result_service import generate_results_for_division
from schemas import EnterMarkSchema, UpdateMarkSchema
from auth import token_required
from config import GRACE_MAX

teacher_bp = Blueprint("teacher", __name__, url_prefix="/teacher")

enter_mark_schema = EnterMarkSchema()
update_mark_schema = UpdateMarkSchema()


# ======================================================
# Helper: check teacher allocation
# ======================================================
def _check_teacher_allocation(teacher_id, subject_id, division):
    return TeacherSubjectAllocation.query.filter_by(
        teacher_id=teacher_id,
        subject_id=subject_id,
        division=division
    ).first()


# ======================================================
# Helpers: determine if all marks for a subject/division exist
# ======================================================
def _eligible_student_count_for_subject(subject_id, division):
    subject = Subject.query.get(subject_id)
    if not subject:
        return 0

    query = Student.query.filter_by(division=division)
    if subject.subject_code in ("HINDI", "IT"):
        query = query.filter(Student.optional_subject == subject.subject_code)
    if subject.subject_code in ("MATHS", "SP"):
        query = query.filter(Student.optional_subject_2 == subject.subject_code)

    return query.count()


def _marks_count_for_subject(subject_id, division):
    return Mark.query.filter_by(subject_id=subject_id, division=division).count()


def _are_all_marks_submitted(subject_id, division):
    eligible = _eligible_student_count_for_subject(subject_id, division)
    if eligible == 0:
        return False
    return _marks_count_for_subject(subject_id, division) >= eligible


# ======================================================
# 1️⃣ Get students for a subject & division
# ======================================================
@teacher_bp.route("/students", methods=["GET"])
@token_required
def get_students(user_id=None, user_type=None):
    """
    Returns students visible to the logged-in teacher
    based on subject + division allocation
    """
    subject_code = request.args.get("subject_code")
    division = request.args.get("division")

    if not subject_code or not division:
        return {"error": "subject_code and division are required"}, 400

    subject = Subject.query.filter_by(subject_code=subject_code).first()
    if not subject:
        return {"error": "Invalid subject"}, 404

    allocation = _check_teacher_allocation(
        user_id, subject.subject_id, division
    )
    if not allocation:
        return {"error": "Not authorized for this subject/division"}, 403

    query = Student.query.filter_by(division=division)

    # Optional subject filtering
    if subject.subject_code in ("HINDI", "IT"):
        query = query.filter(
            Student.optional_subject == subject.subject_code
        )

    if subject.subject_code in ("MATHS", "SP"):
        query = query.filter(
            Student.optional_subject_2 == subject.subject_code
        )

    students = query.order_by(Student.roll_no).all()

    return jsonify([
        {
            "roll_no": s.roll_no,
            "name": s.name,
            "division": s.division
        }
        for s in students
    ]), 200


# ======================================================
# 2️⃣ Enter marks (CREATE)
# ======================================================
@teacher_bp.route("/marks", methods=["POST"])
@token_required
def enter_marks(user_id=None, user_type=None):
    """
    Teacher enters marks for a student (first time)
    """
    data = cast(Dict[str, Any], enter_mark_schema.load(request.json or {}))

    subject = Subject.query.get(data.get("subject_id"))
    if not subject:
        return {"error": "Invalid subject"}, 404

    allocation = _check_teacher_allocation(
        user_id, subject.subject_id, data.get("division")
    )
    if not allocation:
        return {"error": "Not authorized"}, 403

    student = Student.query.filter_by(
        roll_no=data.get("roll_no"),
        division=data.get("division")
    ).first()

    if not student:
        return {"error": "Student not found"}, 404

    # Optional subject validation
    if subject.subject_code in ("HINDI", "IT"):
        if student.optional_subject != subject.subject_code:
            return {"error": "Student not enrolled in this optional subject"}, 400

    if subject.subject_code in ("MATHS", "SP"):
        if student.optional_subject_2 != subject.subject_code:
            return {"error": "Student not enrolled in this optional subject"}, 400

    existing = Mark.query.filter_by(
        roll_no=data["roll_no"],
        division=data["division"],
        subject_id=subject.subject_id
    ).first()

    if existing:
        return {"error": "Marks already exist. Use update instead."}, 409

    # server-side validation for allowed ranges (schemas already validate ranges,
    # but double-check here and enforce grace max)
    unit1 = float(data.get("unit1", 0))
    unit2 = float(data.get("unit2", 0))
    term = float(data.get("term", 0))
    annual = float(data.get("annual", 0))
    grace = float(data.get("grace", 0)) if "grace" in data else 0.0

    if unit1 < 0 or unit1 > 25 or unit2 < 0 or unit2 > 25:
        return {"error": "Unit1 and Unit2 must be between 0 and 25"}, 400
    if term < 0 or term > 50:
        return {"error": "Terminal marks must be between 0 and 50"}, 400
    if annual < 0 or annual > 100:
        return {"error": "Annual marks must be between 0 and 100"}, 400
    if grace < 0 or grace > GRACE_MAX:
        return {"error": f"Grace must be between 0 and {GRACE_MAX}"}, 400

    # Grace is optional and may be provided at any time; limit enforced above.

    # Calculate totals
    tot = unit1 + unit2 + term + annual
    sub_avg = round(tot / 2, 2)  # normalize to 100

    mark = Mark()
    mark.roll_no = data.get("roll_no")
    mark.division = data.get("division")
    mark.subject_id = subject.subject_id
    mark.unit1 = data.get("unit1", 0)
    mark.unit2 = data.get("unit2", 0)
    mark.term = data.get("term", 0)
    mark.annual = data.get("annual", 0)
    mark.tot = tot
    mark.sub_avg = sub_avg
    mark.grace = 0
    mark.entered_by = user_id

    db.session.add(mark)
    db.session.commit()

    return {"message": "Marks entered successfully"}, 201


# ======================================================
# 3️⃣ Update marks
# ======================================================
@teacher_bp.route("/marks/<int:mark_id>", methods=["PUT"])
@token_required
def update_marks(mark_id, user_id=None, user_type=None):
    """
    Update existing marks
    """
    data = cast(Dict[str, Any], update_mark_schema.load(request.json or {}))

    mark = Mark.query.get(mark_id)
    if not mark:
        return {"error": "Marks not found"}, 404

    subject = Subject.query.get(mark.subject_id)
    if not subject:
        return {"error": "Invalid subject"}, 404

    allocation = _check_teacher_allocation(
        user_id, subject.subject_id, mark.division
    )
    if not allocation:
        return {"error": "Not authorized"}, 403

    # validate ranges again server-side
    unit1 = float(data.get("unit1", 0))
    unit2 = float(data.get("unit2", 0))
    term = float(data.get("term", 0))
    annual = float(data.get("annual", 0))
    grace = float(data.get("grace", 0)) if "grace" in data else mark.grace

    if unit1 < 0 or unit1 > 25 or unit2 < 0 or unit2 > 25:
        return {"error": "Unit1 and Unit2 must be between 0 and 25"}, 400
    if term < 0 or term > 50:
        return {"error": "Terminal marks must be between 0 and 50"}, 400
    if annual < 0 or annual > 100:
        return {"error": "Annual marks must be between 0 and 100"}, 400
    if grace < 0 or grace > GRACE_MAX:
        return {"error": f"Grace must be between 0 and {GRACE_MAX}"}, 400

    tot = unit1 + unit2 + term + annual
    sub_avg = round(tot / 2, 2)

    mark.unit1 = data["unit1"]
    mark.unit2 = data["unit2"]
    mark.term = data["term"]
    mark.annual = data["annual"]
    mark.tot = tot
    mark.sub_avg = sub_avg
    # If attempting to change grace, only allow when all marks for the
    # subject/division have been submitted.
    if "grace" in data:
        # allow grace to be set/updated at any time; enforce allowed range
        g = data.get("grace", mark.grace)
        if g is None:
            g = 0
        if float(g) < 0 or float(g) > GRACE_MAX:
            return {"error": f"Grace must be between 0 and {GRACE_MAX}"}, 400
        mark.grace = g

    db.session.commit()

    # regenerate results for the division to reflect changes immediately
    try:
        generate_results_for_division(mark.division)
    except Exception:
        # do not break the update if result generation fails; log in production
        pass

    return {"message": "Marks updated successfully"}, 200


@teacher_bp.route("/marks", methods=["GET"])
@token_required
def list_marks(user_id=None, user_type=None):
    """
    List marks for a given subject_id and division. Returns rows for all students
    (including those without marks) to make frontend table rendering simple.
    Query params: subject_id, division
    """
    subject_id = request.args.get("subject_id")
    division = request.args.get("division")

    if not subject_id or not division:
        return {"error": "subject_id and division are required"}, 400

    # ensure teacher allocation
    alloc = TeacherSubjectAllocation.query.filter_by(teacher_id=user_id, subject_id=subject_id, division=division).first()
    if not alloc and user_type != "ADMIN":
        return {"error": "Not authorized for this subject/division"}, 403

    # fetch students in division
    students = Student.query.filter_by(division=division).order_by(Student.roll_no).all()

    # map existing marks by roll_no
    marks = Mark.query.filter_by(subject_id=subject_id, division=division).all()
    marks_map = {m.roll_no: m for m in marks}

    rows = []
    for s in students:
        m = marks_map.get(s.roll_no)
        rows.append({
            "roll_no": s.roll_no,
            "name": s.name,
            "division": s.division,
                "mark": {
                "mark_id": m.mark_id if m else None,
                "unit1": m.unit1 if m else None,
                "unit2": m.unit2 if m else None,
                "term": m.term if m else None,
                "annual": m.annual if m else None,
                "tot": m.tot if m else None,
                "sub_avg": m.sub_avg if m else None,
                "grace": m.grace if m else 0,
            }
        })

    return jsonify(rows), 200


@teacher_bp.route("/marks/<int:mark_id>", methods=["DELETE"])
@token_required
def delete_mark(mark_id, user_id=None, user_type=None):
    """
    Delete a mark row. Only the teacher who entered it or an ADMIN can delete.
    """
    mark = Mark.query.get(mark_id)
    if not mark:
        return {"error": "Marks not found"}, 404

    # authorization: teacher who entered or admin
    if user_type != "ADMIN" and mark.entered_by != user_id:
        return {"error": "Not authorized to delete this mark"}, 403

    db.session.delete(mark)
    db.session.commit()

    # regenerate results for the division
    try:
        generate_results_for_division(mark.division)
    except Exception:
        pass

    return {"message": "Marks deleted"}, 200


# ======================================================
# 4️⃣ View Complete Table (per-division)
# Returns student list with subject-wise avg, grace and final marks
# ======================================================
@teacher_bp.route("/complete-table", methods=["GET"])
@token_required
def view_complete_table(user_id=None, user_type=None):
    division = request.args.get("division")
    if not division:
        return {"error": "division is required"}, 400

    # Ensure teacher is authorized for this division (has any allocation)
    alloc = TeacherSubjectAllocation.query.filter_by(teacher_id=user_id, division=division).first()
    if not alloc and user_type != "ADMIN":
        return {"error": "Not authorized for this division"}, 403

    # regenerate results to ensure latest values
    try:
        generate_results_for_division(division)
    except Exception:
        pass

    # fetch students in canonical order and build rows
    students = Student.query.filter_by(division=division).order_by(Student.roll_no).all()
    subjects = {s.subject_id: s.subject_code for s in Subject.query.all()}

    rows = []
    for idx, s in enumerate(students, start=1):
        result = None
        from models import Result
        result = Result.query.filter_by(roll_no=s.roll_no, division=s.division).first()

        # build per-subject entries from Result columns
        subject_entries = []
        total_avg = 0
        total_grace = 0

        for code, field in {
            "ENG": "eng",
            "ECO": "eco",
            "BK": "bk",
            "OC": "oc",
        }.items():
            avg = getattr(result, f"{field}_avg", None) if result else None
            grace = getattr(result, f"{field}_grace", 0) if result else 0
            final = None
            if avg is not None:
                final = (avg or 0) + (grace or 0)
                total_avg += avg or 0
                total_grace += grace or 0

            subject_entries.append({"code": code, "avg": avg, "grace": grace, "final": final})

        # optional subjects
        for code, field in {"HINDI": "hindi", "IT": "it", "MATHS": "maths", "SP": "sp"}.items():
            # only include if student takes this optional
            include = False
            if code in ("HINDI", "IT") and s.optional_subject == code:
                include = True
            if code in ("MATHS", "SP") and s.optional_subject_2 == code:
                include = True

            if include:
                avg = getattr(result, f"{field}_avg", None) if result else None
                grace = getattr(result, f"{field}_grace", 0) if result else 0
                final = None
                if avg is not None:
                    final = (avg or 0) + (grace or 0)
                    total_avg += avg or 0
                    total_grace += grace or 0

                subject_entries.append({"code": code, "avg": avg, "grace": grace, "final": final})

        final_total = None
        if subject_entries:
            final_total = total_avg + total_grace

        rows.append({
            "seq": idx,
            "roll_no": s.roll_no,
            "name": s.name,
            "subjects": subject_entries,
            "total_avg": round(total_avg, 2),
            "total_grace": round(total_grace, 2),
            "final_total": round(final_total, 2) if final_total is not None else None,
            "percentage": getattr(result, "percentage", None) if result else None
        })

    return jsonify(rows), 200


@teacher_bp.route("/students-by-division", methods=["GET"])
@token_required
def students_by_division(user_id=None, user_type=None):
    """
    Return list of students for a division. Teacher must have any allocation for that division.
    Query param: division
    """
    division = request.args.get("division")
    if not division:
        return {"error": "division is required"}, 400

    # ensure teacher has allocation for this division
    alloc = TeacherSubjectAllocation.query.filter_by(teacher_id=user_id, division=division).first()
    if not alloc and user_type != "ADMIN":
        return {"error": "Not authorized for this division"}, 403

    students = Student.query.filter_by(division=division).order_by(Student.roll_no).all()
    return jsonify([{"roll_no": s.roll_no, "name": s.name} for s in students]), 200


@teacher_bp.route("/student-marks", methods=["GET"])
@token_required
def student_marks(user_id=None, user_type=None):
    """
    Return all subjects for a student (including optional ones) and existing marks if any.
    Query params: roll_no, division
    """
    roll_no = request.args.get("roll_no")
    division = request.args.get("division")
    if not roll_no or not division:
        return {"error": "roll_no and division are required"}, 400

    # ensure teacher has allocation for this division
    alloc = TeacherSubjectAllocation.query.filter_by(teacher_id=user_id, division=division).first()
    if not alloc and user_type != "ADMIN":
        return {"error": "Not authorized for this division"}, 403

    student = Student.query.filter_by(roll_no=roll_no, division=division).first()
    if not student:
        return {"error": "Student not found"}, 404

    # all active subjects
    all_subjects = Subject.query.filter_by(active=True).order_by(Subject.subject_code).all()

    # determine which optional subjects the student takes
    include_codes = set()
    for s in all_subjects:
        if s.subject_type == 'CORE':
            include_codes.add(s.subject_code)
    if student.optional_subject:
        include_codes.add(student.optional_subject)
    if student.optional_subject_2:
        include_codes.add(student.optional_subject_2)

    subjects = [s for s in all_subjects if s.subject_code in include_codes]

    # map marks
    marks = Mark.query.filter_by(roll_no=roll_no, division=division).all()
    marks_map = {m.subject_id: m for m in marks}

    rows = []
    for s in subjects:
        m = marks_map.get(s.subject_id)
        rows.append({
            "subject_id": s.subject_id,
            "subject_code": s.subject_code,
            "subject_name": s.subject_name,
                "mark": {
                "mark_id": m.mark_id if m else None,
                "unit1": m.unit1 if m else None,
                "unit2": m.unit2 if m else None,
                "term": m.term if m else None,
                "annual": m.annual if m else None,
                "tot": m.tot if m else None,
                "sub_avg": m.sub_avg if m else None,
                "grace": m.grace if m else 0,
            }
        })

    return jsonify({"roll_no": roll_no, "name": student.name, "division": division, "subjects": rows}), 200
