"""Test configuration for the pure 86Proof cloud client."""

import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CUSTOM_COMPONENTS = ROOT / "custom_components"
PROOF86_COMPONENT = CUSTOM_COMPONENTS / "proof86"

# Import pure client/model modules without importing the Home Assistant-dependent
# integration __init__.py. Full HA harness tests will be added before release.
custom_components_package = types.ModuleType("custom_components")
custom_components_package.__path__ = [str(CUSTOM_COMPONENTS)]
sys.modules.setdefault("custom_components", custom_components_package)

proof86_package = types.ModuleType("custom_components.proof86")
proof86_package.__path__ = [str(PROOF86_COMPONENT)]
sys.modules.setdefault("custom_components.proof86", proof86_package)
