"""Constants for the 86Proof integration."""

import logging
from datetime import timedelta

DOMAIN = "proof86"
MANUFACTURER = "86Proof"
MODEL = "Shared Home Bar"
PLATFORMS = ("sensor",)

CONF_BAR_ID = "bar_id"
CONF_BAR_NAME = "bar_name"
CONF_DISPLAY_NAME = "display_name"
CONF_INSTALLATION_ID = "installation_id"
CONF_REFRESH_TOKEN = "refresh_token"
CONF_SHARE_CODE = "share_code"
CONF_VIEWER_UID = "viewer_uid"

DEFAULT_DISPLAY_NAME = "Home Assistant"
DEFAULT_UPDATE_INTERVAL = timedelta(seconds=60)

# Firebase client API keys identify an app/project and are intentionally public.
# Authorization is enforced by Firebase Auth and Firestore Security Rules.
FIREBASE_API_KEY = "AIzaSyAXXvt1EIO81FmU2NJmbdeARdjU_dU95eI"
FIREBASE_PROJECT_ID = "proof-43495"
FIREBASE_DATABASE_ID = "(default)"
FIREBASE_REGION = "us-central1"

AUTHORIZE_FUNCTION_NAME = "authorizeHomeAssistant"
AUTHORIZE_URL = (
    f"https://{FIREBASE_REGION}-{FIREBASE_PROJECT_ID}.cloudfunctions.net/"
    f"{AUTHORIZE_FUNCTION_NAME}"
)
CUSTOM_TOKEN_URL = (
    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken"
    f"?key={FIREBASE_API_KEY}"
)
REFRESH_TOKEN_URL = (
    f"https://securetoken.googleapis.com/v1/token?key={FIREBASE_API_KEY}"
)
FIRESTORE_BASE_URL = (
    "https://firestore.googleapis.com/v1/projects/"
    f"{FIREBASE_PROJECT_ID}/databases/{FIREBASE_DATABASE_ID}/documents"
)

LOGGER = logging.getLogger(__package__)
