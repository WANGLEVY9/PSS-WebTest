"""A malformed model action must not be confused with infrastructure failure."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "experiment"))
from framework_model import ModelOutputValidationError, validate_model_json


class ObjectSchema:
    @staticmethod
    def model_validate_json(raw):
        if not raw.startswith("{"):
            raise ValueError("Expected one object")
        return {"accepted": True}


class ModelOutputValidationTests(unittest.TestCase):
    def test_json_array_is_model_protocol_failure(self):
        with self.assertRaises(ModelOutputValidationError):
            validate_model_json(ObjectSchema, '[{"action": []}]')

    def test_object_passes_through(self):
        self.assertEqual(validate_model_json(ObjectSchema, '{}'), {"accepted": True})


if __name__ == "__main__":
    unittest.main()
