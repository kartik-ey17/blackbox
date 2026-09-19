"""
Verification test script for BlackBox backend fixtures and models.
Runs cleanly under standard Python 3.
"""

import json
from pathlib import Path


def test_fixtures_validity():
    fixtures_dir = Path(__file__).parent / "fixtures"
    assert fixtures_dir.exists(), f"Fixtures dir {fixtures_dir} not found"

    fixtures = list(fixtures_dir.glob("*.json"))
    assert len(fixtures) == 3, f"Expected 3 fixtures, found {len(fixtures)}"

    for fix_path in fixtures:
        with open(fix_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            assert "id" in data
            assert "title" in data
            assert "severity" in data
            assert "status" in data
            assert "blast_radius" in data
            assert "evidence_events" in data
            assert len(data["evidence_events"]) > 0
            print(f"[OK] Fixture {fix_path.name} verified ({len(data['evidence_events'])} evidence events)")

    print("\nAll 3 realistic incident fixtures successfully validated!")


if __name__ == "__main__":
    test_fixtures_validity()
