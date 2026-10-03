"""Run only pinned private evidence validators, isolated from pack Python imports.

This file contains no voice-provider client, private receipts, or generation code.
The selected complete recovery directory remains data; never add it to sys.path.
"""
from pathlib import Path
import hashlib
import json
import sys
import types

PINS = {
    "audio_provenance.py": "9c0207652880d23ca0f7d4cc114ca90a2dfd4bb126b51f847eaa0f293ea75e29",
    "audit_audio.py": "81fa0c537f27164a19c20748c45225f5a5b3bdec7ceec16675f1f2e80d4d5521",
    "finalize_recovery.py": "2e6febfcdcd1d8d7b6963c49a27722b467957bc9691707cefe6bfe24081804ba",
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def regular(root, name):
    file = root / name
    require(file.is_file() and not file.is_symlink() and file.resolve().is_relative_to(root),
            f"Missing or unsafe local evidence file: {name}")
    return file


def main():
    require(sys.flags.isolated and sys.dont_write_bytecode, "Use isolated Python with -I -B")
    root, proposal_path = Path(sys.argv[1]).resolve(), Path(sys.argv[2])
    require(root.is_dir(), "Missing complete recovery directory")
    # Load bytes once, hash before execution, and never import from the pack directory.
    code = {}
    for name, expected in PINS.items():
        code[name] = regular(root, name).read_bytes()
        require(digest(code[name]) == expected, f"Unreviewed audio validator: {name}")
    for name in ("audio_provenance.py", "audit_audio.py"):
        module_name = name.removesuffix(".py")
        module = types.ModuleType(module_name)
        module.__file__ = str(root / name)
        sys.modules[module_name] = module
        exec(compile(code[name], module.__file__, "exec"), module.__dict__)
    provenance, audit = sys.modules["audio_provenance"], sys.modules["audit_audio"]
    require(proposal_path.is_file() and not proposal_path.is_symlink(), "Unsafe explicit proposal")
    proposal_bytes = proposal_path.read_bytes()
    proposal_files = list((root / "sources").glob("batch*-approved-proposal.json"))
    require(len(proposal_files) == 1, "Expected exactly one audited approved proposal")
    embedded = regular(root, str(proposal_files[0].relative_to(root)))
    require(embedded.read_bytes() == proposal_bytes, "Explicit proposal differs from audited proposal")
    manifest_bytes = regular(root, "manifest.json").read_bytes()
    qa_bytes = regular(root, "final-qa.json").read_bytes()
    plan_bytes = regular(root, "plan.json").read_bytes()
    plan, manifest = provenance.load_json(root / "plan.json"), provenance.load_json(root / "manifest.json")
    qa = provenance.load_json(root / "final-qa.json")
    before = provenance._snapshot(root)
    report = audit.run_audit(root)
    resume = provenance.verify_local_resume(root, plan, manifest)
    require(before == provenance._snapshot(root), "Evidence changed during import audit")
    require(regular(root, "manifest.json").read_bytes() == manifest_bytes and
            regular(root, "final-qa.json").read_bytes() == qa_bytes and
            regular(root, "plan.json").read_bytes() == plan_bytes and
            proposal_path.read_bytes() == proposal_bytes and embedded.read_bytes() == proposal_bytes,
            "Approved input changed during audit")
    require(all(regular(root, n).read_bytes() == data for n, data in code.items()), "Validator changed during audit")
    summary = report["summary"]
    require(qa.get("audioSummary") == summary, "Saved final QA differs from fresh audio audit")
    for key in ("readyCount", "successfulReturnedRecordings"):
        require(type(qa.get(key)) is int and qa[key] == 24, f"Invalid final QA {key}")
    require(qa.get("exactApprovedContractMapping") is True and qa.get("allPriorFilesUnchanged") is True and
            isinstance(qa.get("parentApprovalReference"), str) and bool(qa["parentApprovalReference"].strip()),
            "Finalized independent-review QA is required")
    for key in ("http200ReceiptCount", "browserUiReceiptCount", "initialOutcomesUnconfirmed",
                "generatedUnrecoveredHistoricalOutcomes", "archivedAdditionalAttemptRecords"):
        require(type(qa.get(key)) is int and qa[key] == summary[key], f"Final QA provenance count mismatch: {key}")
    require(qa.get("priorUnknownOutcomesResolved") is False and
            all(qa.get(k) is False for k in ("audibleQualityVerified", "speechContentVerified", "iphoneVoiceOverVerified")),
            "Mechanical import cannot certify listening or resolve historical outcomes")
    current_attempts = sum(len(c["attempts"]) for c in manifest["clips"].values())
    total_attempts = current_attempts + summary["archivedAdditionalAttemptRecords"]
    require(type(qa.get("currentCheckpointAttemptRecords")) is int and
            qa["currentCheckpointAttemptRecords"] == current_attempts and
            type(qa.get("recordedSubmissionAttempts")) is int and qa["recordedSubmissionAttempts"] == total_attempts,
            "Final QA attempt-history counts mismatch")
    if summary["browserUiReceiptCount"] or summary["initialOutcomesUnconfirmed"]:
        require(qa.get("providerRequestsConfirmed") is None, "Unobserved provider request totals must remain unknown")
    else:
        require(type(qa.get("providerRequestsConfirmed")) is int and qa["providerRequestsConfirmed"] == total_attempts,
                "Historical provider request count differs from preserved receipts")
    print(json.dumps({"summary": summary, "resume": resume,
        "proposalSha256": digest(proposal_bytes), "manifestSha256": digest(manifest_bytes),
        "finalQaSha256": digest(qa_bytes), "planSha256": digest(plan_bytes), "scriptSha256": PINS}))


if __name__ == "__main__":
    main()
