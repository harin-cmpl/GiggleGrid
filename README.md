# GiggleGrid — Women's Day Photobooth

> Grin together, click together

A browser-based photobooth that detects faces, counts down, snaps a framed photo, uploads it to AWS S3, and shows a QR code so users can download their picture instantly.

---

## Architecture

```
Browser (laptop at event)
  ├─ MediaPipe Face Detection (in-browser, WASM)
  ├─ Countdown → Canvas capture → Frame overlay
  └─ POST /upload → API Gateway → Lambda → S3
                                              └─ presigned URL → QR code
```

| Component | Tech |
|-----------|------|
| Frontend  | Vanilla JS (ES modules), HTML5 Canvas, MediaPipe |
| Backend   | AWS Lambda (Python 3.12), API Gateway HTTP API |
| Storage   | S3 (private, presigned URLs, lifecycle auto-delete) |
| Hosting   | S3 static site + CloudFront (HTTPS, custom domain) |
| CI/CD     | GitHub Actions with OIDC (no static AWS keys) |
| IaC       | AWS SAM (`backend/template.yaml`) |

---

## Prerequisites

- **AWS account** — [Create one here](https://portal.aws.amazon.com/billing/signup)
- **AWS CLI v2** — `brew install awscli`
- **AWS SAM CLI** — `brew install aws-sam-cli`
- **Python 3.12** — `brew install python@3.12`
- **Node.js 20+** — only needed for frontend linting in CI
- **Git**

---

## AWS Account Setup

### 1. Create an IAM user for local development

```bash
aws iam create-user --user-name gigglegrid-dev
aws iam attach-user-policy \
  --user-name gigglegrid-dev \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
aws iam create-access-key --user-name gigglegrid-dev
```

Configure the credentials:

```bash
aws configure --profile gigglegrid
# Enter the Access Key ID and Secret from above
# Region: us-east-1
```

### 2. Deploy the stack (first time)

```bash
cd backend
sam build
sam deploy \
  --region us-east-1 \
  --profile gigglegrid \
  --stack-name gigglegrid \
  --resolve-s3 \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    Environment=production \
    CustomDomain=gigglegrid.zeusserver.in \
    AcmCertificateArn=arn:aws:acm:us-east-1:<ACCOUNT>:certificate/<CERT_ID> \
    AllowedOrigin=https://gigglegrid.zeusserver.in \
    PresignedUrlExpirySeconds=86400 \
    S3RetentionDays=7 \
    MaxImageBytes=10485760 \
    GitHubOrg=<YOUR_GITHUB_USERNAME> \
    GitHubRepo=GiggleGrid
```

Notes:
- The ACM certificate **must be in us-east-1** (CloudFront requirement).
- `--resolve-s3` will create a managed artifacts bucket for you.
- After deploy, capture **Outputs** (`ApiUrl`, `FrontendBucketName`, `CloudFrontDistributionId`, `CloudFrontDomainName`).

### 3. Upload the frontend

```bash
# Replace values from SAM outputs
aws s3 sync frontend/ s3://YOUR_FRONTEND_BUCKET --delete --profile gigglegrid
```

### 4. Set up GitHub OIDC (for CI/CD)

Redeploy with your GitHub org name to create the OIDC role:

```bash
sam deploy \
  --region us-east-1 \
  --profile gigglegrid \
  --stack-name gigglegrid \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-confirm-changeset \
  --parameter-overrides GitHubOrg=YOUR_GITHUB_USERNAME GitHubRepo=GiggleGrid
```

Then add these **GitHub repository secrets and variables**:

| Type | Name | Value |
|------|------|-------|
| Secret | `AWS_OIDC_ROLE_ARN` | From SAM output `GitHubActionsRoleArn` |
| Secret | `ACM_CERTIFICATE_ARN` | Your ACM cert ARN (if using custom domain) |
| Variable | `AWS_REGION` | `us-east-1` |
| Variable | `API_ENDPOINT` | From SAM output `ApiUrl` |
| Variable | `FRONTEND_BUCKET` | From SAM output `FrontendBucketName` |
| Variable | `CLOUDFRONT_DISTRIBUTION_ID` | From SAM output `CloudFrontDistributionId` |
| Variable | `CUSTOM_DOMAIN` | Your domain (optional) |
| Variable | `COUNTDOWN_SECONDS` | `5` (or your preference) |
| Variable | `QR_DISPLAY_SECONDS` | `15` |
| Variable | `S3_RETENTION_DAYS` | `7` |

---

## Local Development

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt

# Run tests
pytest tests/ -v

# Lint
ruff check src/ tests/
black --check src/ tests/
```

### Frontend

Serve the frontend locally with any static server:

```bash
cd frontend
python3 -m http.server 8000
# Open http://localhost:8000
```

> **Note:** Update `API_ENDPOINT` in `frontend/config.js` to point to your deployed API Gateway URL, or run `sam local start-api` in the backend directory for a local Lambda.

---

## Configuration

All tuneable values are runtime-configurable — no code changes or full redeploys needed.

### Frontend (`frontend/config.js`)

| Variable | Default | Description |
|----------|---------|-------------|
| `COUNTDOWN_SECONDS` | `5` | Seconds before snap |
| `QR_DISPLAY_SECONDS` | `15` | QR display duration |
| `API_ENDPOINT` | — | Backend API URL (injected by CI/CD) |
| `DETECTION_CONFIDENCE` | `0.7` | Face detection threshold (0–1) |
| `DETECTION_FRAME_THRESHOLD` | `5` | Consecutive frames with face before countdown |

### Backend (Lambda environment variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `PRESIGNED_URL_EXPIRY_SECONDS` | `86400` | Download link lifetime |
| `MAX_IMAGE_BYTES` | `10485760` | Max upload size (10 MB) |
| `S3_RETENTION_DAYS` | `7` | Auto-delete photos after N days |
| `ALLOWED_ORIGIN` | `*` | CORS origin |

---

## Swapping the Photo Frame

Replace `frontend/assets/frame.svg` (or add `frame.png`) with your own overlay:

- **Format:** SVG or PNG with transparent center
- **Dimensions:** 1920 × 1080 (matches camera resolution)
- Update the path in `frontend/src/app.js` if you change the filename

---

## Project Structure

```
GiggleGrid/
├── frontend/
│   ├── index.html              # Entry point
│   ├── config.js               # Runtime config
│   ├── src/
│   │   ├── app.js              # State machine orchestrator
│   │   ├── camera.js           # Webcam setup
│   │   ├── detection.js        # MediaPipe face detection
│   │   ├── countdown.js        # Timer UI
│   │   ├── capture.js          # Canvas compositing + frame overlay
│   │   ├── uploader.js         # API call with retry
│   │   └── qr.js               # QR code render + auto-reset
│   ├── styles/main.css
│   └── assets/frame.svg        # Placeholder photobooth frame
├── backend/
│   ├── src/
│   │   ├── handler.py          # Lambda entry point
│   │   ├── upload.py           # S3 upload + presigned URL
│   │   ├── config.py           # Env var parsing
│   │   └── exceptions.py       # Typed errors
│   ├── tests/
│   ├── template.yaml           # AWS SAM (infra-as-code)
│   ├── requirements.txt
│   └── pyproject.toml          # Linter config
├── .github/workflows/
│   ├── ci.yml                  # Lint + test on PRs
│   ├── deploy-frontend.yml     # S3 sync + CloudFront invalidation
│   └── deploy-backend.yml      # SAM build + deploy
└── .env.example
```

---

## License

MIT
