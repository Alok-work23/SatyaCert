import json


def is_ignored(value):
    """Return True if value should be ignored for comparison."""
    if value is None or value is False or value == "":
        return True
    if isinstance(value, (dict, list)) and len(value) == 0:
        return True
    return False


def compare_json(obj1, obj2):
    """Recursively return only the differences between two JSON objects."""

    if is_ignored(obj1) and is_ignored(obj2):
        return None

    if isinstance(obj1, dict) and isinstance(obj2, dict):
        diff = {}
        for key in set(obj1.keys()) | set(obj2.keys()):
            if key in ("_id", "__v"):
                continue
            d = compare_json(obj1.get(key), obj2.get(key))
            if d is not None:
                diff[key] = d
        return diff if diff else None

    if isinstance(obj1, list) and isinstance(obj2, list):
        max_len = max(len(obj1), len(obj2))
        diff_list = []
        any_diff = False
        for i in range(max_len):
            v1 = obj1[i] if i < len(obj1) else None
            v2 = obj2[i] if i < len(obj2) else None
            d = compare_json(v1, v2)
            diff_list.append(d)
            if d is not None:
                any_diff = True
        return diff_list if any_diff else None

    if obj1 != obj2:
        return {"uploaded": obj1, "database": obj2}

    return None


def flatten_diff(diff, prefix=""):
    """
    Walk the diff tree and collect a flat list of mismatched field paths.
    Used to generate the human-readable forgery report.
    """
    mismatches = []
    if isinstance(diff, dict):
        # Leaf node: {"uploaded": x, "database": y}
        if "uploaded" in diff and "database" in diff:
            mismatches.append({
                "field": prefix,
                "uploaded_value": diff["uploaded"],
                "database_value": diff["database"],
            })
        else:
            for key, val in diff.items():
                child_prefix = f"{prefix}.{key}" if prefix else key
                mismatches.extend(flatten_diff(val, child_prefix))
    elif isinstance(diff, list):
        for i, item in enumerate(diff):
            if item is not None:
                mismatches.extend(flatten_diff(item, f"{prefix}[{i}]"))
    return mismatches


# Critical fields that, if tampered, strongly indicate forgery
CRITICAL_FIELDS = {
    "marksheet.rollNo",
    "marksheet.student_info.name",
    "marksheet.student_info.roll_no",
    "marksheet.academic_info.sgpa",
    "marksheet.academic_info.cgpa",
    "marksheet.academic_info.result_status",
    "marksheet.document_metadata.university_name",
}


def generate_verdict(mismatches: list) -> dict:
    """
    Given a flat list of mismatches, produce a human-readable verdict.
    Returns a dict with: is_authentic, risk_level, summary, mismatches
    """
    if not mismatches:
        return {
            "is_authentic": True,
            "risk_level": "NONE",
            "summary": "Document matches institutional records. No tampering detected.",
            "total_mismatches": 0,
            "critical_mismatches": [],
            "non_critical_mismatches": [],
        }

    critical = [m for m in mismatches if m["field"] in CRITICAL_FIELDS]
    non_critical = [m for m in mismatches if m["field"] not in CRITICAL_FIELDS]

    if critical:
        risk = "HIGH"
        summary = (
            f"FORGERY DETECTED — {len(critical)} critical field(s) tampered: "
            + ", ".join(m["field"] for m in critical)
        )
        is_authentic = False
    elif len(non_critical) >= 3:
        risk = "MEDIUM"
        summary = f"SUSPICIOUS — {len(non_critical)} non-critical mismatches found. Manual review recommended."
        is_authentic = False
    else:
        risk = "LOW"
        summary = f"{len(non_critical)} minor mismatch(es) found. Likely a formatting difference."
        is_authentic = True

    return {
        "is_authentic": is_authentic,
        "risk_level": risk,
        "summary": summary,
        "total_mismatches": len(mismatches),
        "critical_mismatches": critical,
        "non_critical_mismatches": non_critical,
    }


def compare_json_files(json1: dict, json2: dict) -> dict:
    """
    Compare two marksheet JSON dicts.
    Returns a result dict with the raw diff AND a human-readable verdict.
    """
    raw_diff = compare_json(json1, json2)
    diff_obj = raw_diff if raw_diff is not None else {}

    mismatches = flatten_diff(diff_obj)
    verdict = generate_verdict(mismatches)

    return {
        "verdict": verdict,
        "diff": diff_obj,
    }


if __name__ == "__main__":
    # Quick self-test
    doc1 = {"marksheet": {"rollNo": "12345", "academic_info": {"cgpa": 8.5, "sgpa": 8.1}}}
    doc2 = {"marksheet": {"rollNo": "12345", "academic_info": {"cgpa": 9.5, "sgpa": 8.1}}}
    result = compare_json_files(doc1, doc2)
    print(json.dumps(result, indent=2))