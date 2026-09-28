# EAS build profiles

`eas.json` defines five build profiles. None of them hardcode a server URL —
API URLs come from EAS-managed environment variables, linked per profile via
the `"environment"` field, so nothing sensitive or machine-specific is
committed to the repo.

| Profile | Purpose | Network | `EXPO_PUBLIC_API_BASE_URL` source | Cleartext HTTP |
|---|---|---|---|---|
| `development` | Dev client | n/a (Metro) | n/a | n/a |
| `preview` | Offline demo APK | none (`EXPO_PUBLIC_DEMO_MODE=true`) | unused | blocked |
| `hosted` | Real APK against the hosted server | HTTPS | EAS `production` environment | blocked |
| `lan-dev` | Testing against a developer's laptop | HTTP (LAN) | EAS `development` environment | **allowed** (`expo-build-properties`, this profile only) |
| `production` | Play Store submission | HTTPS | EAS `production` environment | blocked |

## ⚠️ `production` is not ready for the Play Store

The `production` profile builds a real app-bundle against the real API, but
**do not submit it to the Play Store until the app has real authentication.**
Today's login is the mock-persona flow used for the demo/pilot — anyone who
installs the app can pick any ASHA/ANM identity with no credential check.

## One-time setup: create the EAS environment variables

```bash
cd frontend

# Real hosted API URL (used by "hosted" and "production")
eas env:create --scope project --environment production \
  --name EXPO_PUBLIC_API_BASE_URL --value https://your-hosted-domain.example.com \
  --visibility plaintext

# Your laptop's LAN IP (used by "lan-dev"). Re-run this whenever the IP
# changes (e.g. a different Wi-Fi network) — find it with `ipconfig`.
eas env:create --scope project --environment development \
  --name EXPO_PUBLIC_API_BASE_URL --value http://192.168.1.42:3001 \
  --visibility plaintext
```

To update an existing value later, use `eas env:update` instead of `create`.

## Building

```bash
cd frontend

eas build --profile hosted --platform android    # real server, HTTPS
eas build --profile lan-dev --platform android    # your laptop, HTTP (LAN)
eas build --profile preview --platform android    # offline demo, unchanged
```

`lan-dev` also needs a Windows Firewall inbound rule allowing TCP 3001 on
the **Private** network profile on the laptop running `local-api` — dev-only,
not needed for `hosted`/`production` since those talk to a real hosted server.
