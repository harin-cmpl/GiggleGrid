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

Wall Display (wall.zeusserver.in)
  └─ GET /photos/random → API Gateway → Lambda → S3
                                └─ random photo presigned URL → slideshow
```

| Component | Tech |
|-----------|------|
| Frontend  | Vanilla JS (ES modules), HTML5 Canvas, MediaPipe |
| Photo Wall | Vanilla JS (ES modules), CSS animations, CloudFront |
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
    CustomDomain=gigglegrin.zeusserver.in \
    AcmCertificateArn=arn:aws:acm:us-east-1:<ACCOUNT>:certificate/<CERT_ID> \
    AllowedOrigin=https://gigglegrin.zeusserver.in \
    WallAllowedOrigin=https://wall.zeusserver.in \
    WallDomain=wall.zeusserver.in \
    WallAcmCertificateArn=arn:aws:acm:us-east-1:<ACCOUNT>:certificate/<CERT_ID> \
    PresignedUrlExpirySeconds=86400 \
    S3RetentionDays=7 \
    MaxImageBytes=10485760 \
    GitHubOrg=<YOUR_GITHUB_USERNAME> \
    GitHubRepo=GiggleGrid
```

Notes:
- The ACM certificate **must be in us-east-1** (CloudFront requirement).
- `--resolve-s3` will create a managed artifacts bucket for you.
- After deploy, capture **Outputs** (`ApiUrl`, `FrontendBucketName`, `CloudFrontDistributionId`, `CloudFrontDomainName`, `PhotoWallCloudFrontDistributionId`, `PhotoWallCloudFrontDomainName`).

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
| Variable | `PHOTOWALL_CLOUDFRONT_DISTRIBUTION_ID` | From SAM output `PhotoWallCloudFrontDistributionId` |
| Variable | `CUSTOM_DOMAIN` | Your domain (optional) |
| Variable | `WALL_DOMAIN` | `wall.zeusserver.in` (or your wall domain) |
| Variable | `COUNTDOWN_SECONDS` | `5` (or your preference) |
| Variable | `QR_DISPLAY_SECONDS` | `15` |
| Variable | `SLIDE_DURATION_SECONDS` | `10` |
| Variable | `WALL_ALLOWED_ORIGIN` | `https://wall.zeusserver.in` |
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

### Photo Wall

Serve the wall frontend locally:

```bash
cd photowall
python3 -m http.server 8001
# Open http://localhost:8001
```

> **Note:** Update `API_ENDPOINT` in `photowall/config.js` to your deployed API URL.

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

### Photo Wall Frontend (`photowall/config.js`)

| Variable | Default | Description |
|----------|---------|-------------|
| `API_ENDPOINT` | — | Backend API URL (injected by CI/CD) |
| `SLIDE_DURATION_SECONDS` | `10` | Seconds each photo is shown |
| `FETCH_RETRY_MS` | `3000` | Retry delay after fetch failures |

### Backend (Lambda environment variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `PRESIGNED_URL_EXPIRY_SECONDS` | `86400` | Download link lifetime |
| `MAX_IMAGE_BYTES` | `10485760` | Max upload size (10 MB) |
| `S3_RETENTION_DAYS` | `7` | Auto-delete photos after N days |
| `ALLOWED_ORIGIN` | `*` | CORS origin |
| `WALL_ALLOWED_ORIGIN` | `*` | CORS origin for wall domain |

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
├── photowall/
│   ├── index.html              # Wall slideshow page
│   ├── config.js               # Wall runtime config
│   ├── src/app.js              # Random-photo slideshow loop
│   └── styles/main.css         # Wall animations + polaroid cards
├── backend/
│   ├── src/
│   │   ├── handler.py          # Lambda entry point
│   │   ├── upload.py           # S3 upload + presigned URL
│   │   ├── photos.py           # Random photo retrieval endpoint
│   │   ├── config.py           # Env var parsing
│   │   └── exceptions.py       # Typed errors
│   ├── tests/
│   ├── template.yaml           # AWS SAM (infra-as-code)
│   ├── requirements.txt
│   └── pyproject.toml          # Linter config
├── .github/workflows/
│   ├── ci.yml                  # Lint + test on PRs
│   ├── deploy-frontend.yml     # S3 sync + CloudFront invalidation
│   ├── deploy-photowall.yml    # Wall sync + dual invalidation
│   └── deploy-backend.yml      # SAM build + deploy
└── .env.example
```

---

## License

MIT
