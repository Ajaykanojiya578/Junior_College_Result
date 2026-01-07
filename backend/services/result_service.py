# /backend/services/result_service.py

from models import Student, Mark, Result, Subject, TeacherSubjectAllocation
from app import db


def generate_results_for_division(division: str):
    """
    Generate / update results for all students in a division.

    Only create/update a Result row for a student when marks for all
    required subjects (core + their chosen optional subjects) are present.
    """

    # Fetch subjects mapping
    subjects = {s.subject_id: s.subject_code for s in Subject.query.all()}

    students = Student.query.filter_by(division=division).all()

    for student in students:
        marks = Mark.query.filter_by(
            roll_no=student.roll_no,
            division=student.division,
        ).all()

        # Map subject_code → mark
        mark_map = {}
        for m in marks:
            code = subjects.get(m.subject_id)
            if code:
                mark_map[code] = m

        # Determine required subject codes for this student.
        # Prefer deriving required subjects from teacher allocations for the student's division.
        grading_only = {"EVS", "PE"}
        optional_codes = {"HINDI", "IT", "MATHS", "SP"}

        allocs = TeacherSubjectAllocation.query.filter_by(division=student.division).all()
        base_required = []
        if allocs:
            for a in allocs:
                code = subjects.get(a.subject_id)
                if not code:
                    continue
                # exclude grading-only and optional-coded subjects here
                if code in grading_only or code in optional_codes:
                    continue
                if code not in base_required:
                    base_required.append(code)
        else:
            # fallback to sensible defaults if no allocations found
            base_required = ["ENG", "ECO", "BK", "OC"]

        required_codes = list(base_required)
        if student.optional_subject in ("HINDI", "IT"):
            required_codes.append(student.optional_subject)
        if student.optional_subject_2 in ("MATHS", "SP"):
            required_codes.append(student.optional_subject_2)

        # If any required subject is missing Annual marks, do not compute percentage
        missing_required = False
        for code in required_codes:
            m = mark_map.get(code)
            if not m or m.annual is None:
                missing_required = True
                break
        if missing_required:
            # If a Result already exists, clear its percentage to avoid showing stale/incorrect values
            existing = Result.query.filter_by(roll_no=student.roll_no, division=student.division).first()
            if existing:
                existing.percentage = None
                db.session.add(existing)
            # Skip calculation for this student until all required Annual marks are present
            continue

        # All required marks are present — proceed to create/update result
        result = Result.query.filter_by(
            roll_no=student.roll_no,
            division=student.division,
        ).first()

        if not result:
            # SQLAlchemy model `Result` does not define a custom __init__ that
            # accepts kwargs for columns; assign attributes explicitly to
            # satisfy static checkers and avoid unexpected __init__ behavior.
            result = Result()
            result.roll_no = student.roll_no
            result.name = student.name
            result.division = student.division

        # total sums Annual marks only (used for percentage calculation)
        total = 0.0
        count = 0

        # ---------------- CORE SUBJECTS ----------------
        for code, field in {
            "ENG": "eng",
            "ECO": "eco",
            "BK": "bk",
            "OC": "oc",
        }.items():
            m = mark_map.get(code)
            if m:
                annual = m.annual if m.annual is not None else 0.0
                grace = m.grace or 0.0
                # Store Annual in the result avg fields (avg kept only for compatibility/display)
                setattr(result, f"{field}_avg", annual)
                setattr(result, f"{field}_grace", grace)
                total += annual
                count += 1

        # ---------------- OPTIONAL GROUP 1 ----------------
        if student.optional_subject == "HINDI":
            m = mark_map.get("HINDI")
            annual = m.annual if m and m.annual is not None else 0.0
            result.hindi_avg = annual
            result.hindi_grace = (m.grace if m and m.grace is not None else 0.0)
            total += result.hindi_avg
            count += 1
        elif student.optional_subject == "IT":
            m = mark_map.get("IT")
            annual = m.annual if m and m.annual is not None else 0.0
            result.it_avg = annual
            result.it_grace = (m.grace if m and m.grace is not None else 0.0)
            total += result.it_avg
            count += 1

        # ---------------- OPTIONAL GROUP 2 ----------------
        if student.optional_subject_2 == "MATHS":
            m = mark_map.get("MATHS")
            annual = m.annual if m and m.annual is not None else 0.0
            result.maths_avg = annual
            result.maths_grace = (m.grace if m and m.grace is not None else 0.0)
            total += result.maths_avg
            count += 1
        elif student.optional_subject_2 == "SP":
            m = mark_map.get("SP")
            annual = m.annual if m and m.annual is not None else 0.0
            result.sp_avg = annual
            result.sp_grace = (m.grace if m and m.grace is not None else 0.0)
            total += result.sp_avg
            count += 1

        # ---------------- FINAL CALC ----------------
        result.total_grace = sum(
            g for g in [
                result.eng_grace,
                result.hindi_grace,
                result.it_grace,
                result.maths_grace,
                result.sp_grace,
                result.bk_grace,
                result.oc_grace,
            ]
            if g is not None
        )

        # Percentage is calculated only from Annual marks (avg fields now store Annual)
        # Exclude grade-only subjects (EVS, PE) from the calculation
        if count > 0:
            result.percentage = round((total / count), 2)

        # EVS and PE are grade-only. If annual marks exist for them, convert to grade and store.
        evs_mark = mark_map.get('EVS')
        if evs_mark and evs_mark.annual is not None:
            a = evs_mark.annual
            if a >= 75:
                result.evs_grade = 'A+'
            elif a >= 60:
                result.evs_grade = 'A'
            elif a >= 50:
                result.evs_grade = 'B'
            elif a >= 35:
                result.evs_grade = 'C'
            else:
                result.evs_grade = 'F'

        pe_mark = mark_map.get('PE')
        if pe_mark and pe_mark.annual is not None:
            a = pe_mark.annual
            if a >= 75:
                result.pe_grade = 'A+'
            elif a >= 60:
                result.pe_grade = 'A'
            elif a >= 50:
                result.pe_grade = 'B'
            elif a >= 35:
                result.pe_grade = 'C'
            else:
                result.pe_grade = 'F'

        db.session.add(result)

    db.session.commit()
