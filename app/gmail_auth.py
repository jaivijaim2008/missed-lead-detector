import os
import sys
import webbrowser

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
]

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
CREDENTIALS_FILE = os.path.join(PROJECT_ROOT, "credentials", "credentials.json")
TOKEN_FILE = os.path.join(PROJECT_ROOT, "credentials", "token.json")
TOKEN_SEND_FILE = os.path.join(PROJECT_ROOT, "credentials", "token_send.json")


def open_browser_windows(url, new=0, autoraise=True):
    print("\n========================================================", flush=True)
    print("OPENING BROWSER FOR GOOGLE AUTHENTICATION...", flush=True)
    print("If it does not open automatically, copy and paste this URL into your browser:", flush=True)
    print(url, flush=True)
    print("========================================================\n", flush=True)

    try:
        # Use Windows ShellExecute via start command for reliable browser launch on Windows
        os.system(f'start "" "{url}"')
        return True
    except Exception:
        return webbrowser.open_new(url)


def get_gmail_service(credentials_path=CREDENTIALS_FILE, token_path=None, scopes=None):
    # Prefer the full-scope token (send + read) if available
    if token_path is None:
        token_path = TOKEN_SEND_FILE if os.path.exists(TOKEN_SEND_FILE) else TOKEN_FILE
    if scopes is None:
        scopes = SCOPES

    creds = None

    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(
            token_path,
            scopes
        )

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(credentials_path):
                raise FileNotFoundError(
                    f"Credentials file not found at: {credentials_path}\n"
                    "Please place your credentials.json file in the credentials/ directory."
                )

            flow = InstalledAppFlow.from_client_secrets_file(
                credentials_path,
                scopes
            )

            # Patch webbrowser.open to ensure Windows default browser launches reliably
            webbrowser.open = open_browser_windows

            creds = flow.run_local_server(
                port=0,
                success_message="Authentication successful! You may close this window and return to VS Code."
            )

        with open(token_path, "w") as token:
            token.write(creds.to_json())

    return build("gmail", "v1", credentials=creds)


def main():
    service = get_gmail_service()

    results = service.users().labels().list(
        userId="me"
    ).execute()

    labels = results.get("labels", [])

    print("\n==============================")
    print("GMAIL CONNECTION SUCCESSFUL")
    print("==============================")

    print("\nGmail labels:")

    for label in labels:
        print("-", label["name"])


if __name__ == "__main__":
    main()

