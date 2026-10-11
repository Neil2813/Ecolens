# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
import os
import sys
from dotenv import load_dotenv

# Ensure the backend directory is in the import path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(backend_dir)

load_dotenv()

from app.db.session import init_db, db_url, engine

def main():
    print("==================================================")
    print(" EcoLens Supabase / PostgreSQL Database Setup")
    print("==================================================")
    
    # Redact password for logging
    display_url = db_url
    if "@" in db_url:
        parts = db_url.split("@")
        scheme_and_user = parts[0].split(":")
        # Redact the password if present
        if len(scheme_and_user) > 2:
            redacted_scheme_user = f"{scheme_and_user[0]}:{scheme_and_user[1]}:****"
        else:
            redacted_scheme_user = scheme_and_user[0]
        display_url = f"{redacted_scheme_user}@{parts[1]}"
        
    print(f"[*] Target Database URI: {display_url}")
    
    if "sqlite" in db_url:
        print("[!] Warning: DATABASE_URL points to a local SQLite file.")
        print("    If you want to configure Supabase, please edit the 'DATABASE_URL' value")
        print("    in your Backend/.env file.")
        print("    Example: DATABASE_URL=postgresql://postgres.[username]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true")
        print("==================================================")
        return

    print("[*] Connecting to database, enabling PostGIS, and creating schemas...")
    try:
        init_db()
        # Verify if fallback to SQLite occurred
        if "sqlite" in str(engine.url) and not "sqlite" in db_url:
            print("[-] Error: Connection to Supabase failed and fell back to local SQLite fallback.db!")
            print("    Please check the connection settings or password in your Backend/.env file.")
            print("==================================================")
            sys.exit(1)
        print("[+] Success! All tables created successfully and PostGIS extension is enabled.")
        print("==================================================")
    except Exception as e:
        print(f"[-] Error: Failed to setup database schemas.\n    Details: {e}")
        print("==================================================")
        sys.exit(1)

if __name__ == "__main__":
    main()
