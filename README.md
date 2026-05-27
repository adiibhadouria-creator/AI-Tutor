# AI Tutor – Cloudflare Native AI Tutor

## **Project Description**

ProfAI v2 is an adaptive AI-powered tutoring platform designed to provide personalized learning experiences for students. The system allows users to enter any topic, attempt a diagnostic quiz, and continue learning through an interactive Socratic-style AI chat interface.

The project includes features such as AI-generated diagrams, progress tracking dashboards, PDF report generation, multi-chat history management, secure authentication, and cloud-based storage. The application is built completely on Cloudflare’s serverless ecosystem for scalability, security, and performance.

---

# **Technology Stack and Tools Used**

## **Frontend**

* React 19
* Vinext (Next.js API surface on Vite)
* Tailwind CSS v3
* shadcn/ui

## **Backend**

* Cloudflare Workers
* Vinext Route Handlers (`app/api/*`)

## **Database**

* Cloudflare D1 (SQLite)
* Drizzle ORM

## **Cloud Storage**

* Cloudflare R2

## **Artificial Intelligence**

* Google Gemini 3 Flash (`env.AI.run`)
* Cloudflare AI Models
* Black Forest Labs Flux-1-Schnell (AI Diagram Generation)

## **Authentication & Security**

* Email and Password Authentication
* Scrypt Password Hashing
* AES-GCM Encryption
* HKDF Key Derivation
* D1-backed Session Tokens
* Secure `__Host-` Cookies

## **PDF Generation**

* Cloudflare Browser Rendering
* Puppeteer (`@cloudflare/puppeteer`)

## **Development & Deployment Tools**

* Node.js
* Wrangler CLI
* npm

---

# **Features and Functionalities Implemented**

## **User Authentication**

* User signup and login using email and password
* Secure password hashing using scrypt
* Session-based authentication with secure cookies

## **Adaptive AI Tutoring**

* Topic-based intelligent tutoring
* 5-question diagnostic assessment
* Personalized learning flow based on performance
* Socratic teaching methodology

## **AI Chat System**

* Multi-chat support with ChatGPT-style sidebar
* Real-time AI interaction
* Persistent chat history storage

## **AI Diagram Generation**

* Automatic generation of educational diagrams and visual explanations using AI

## **Dashboard and Progress Tracking**

* Student learning progress dashboard
* Performance analysis and report generation

## **PDF Export System**

* Generate downloadable PDF reports of learning sessions and progress

## **Cloud Storage Integration**

* R2 storage for:

  * Uploaded files
  * Generated diagrams
  * PDF reports

## **Security Features**

* AES-GCM encryption for stored chat content
* Secure session management
* Sliding 30-day authentication session expiry

## **Scalable Cloud Architecture**

* Fully serverless architecture using Cloudflare ecosystem
* Optimized for scalability and performance

---

# **Installation and Execution Steps**

## **Prerequisites**

Before running the project, install the following:

* Node.js 20+
* npm
* Cloudflare Account
* Wrangler CLI

Login to Wrangler:

```bash
wrangler login
```

---

## **Step 1: Clone the Repository**

```bash
git clone <repository-url>
cd profai-v2
```

---

## **Step 2: Configure Environment Variables**

Create environment variables file:

```bash
cp .dev.vars.example .dev.vars
```

Fill the following values inside `.dev.vars`:

```env
CONTENT_KEY=your_generated_key
IP_HASH_SALT=your_random_string
AI_GATEWAY_GOOGLE_API_KEY=your_google_api_key
```

Generate secure content key:

```bash
openssl rand -base64 32
```

---

## **Step 3: Install Dependencies**

```bash
npm install
```

---

## **Step 4: Create Cloudflare Resources**

### **Create D1 Database**

```bash
npx wrangler d1 create profai_db
```

### **Create KV Namespace**

```bash
npx wrangler kv namespace create profai_kv
```

### **Create R2 Bucket**

```bash
npx wrangler r2 bucket create profai-uploads
```

Paste generated IDs into `wrangler.jsonc`.

---

## **Step 5: Run Database Migrations**

```bash
npm run db:migrate:local
```

---

## **Step 6: Start Development Server**

```bash
npm run dev
```

Open in browser:

```text
http://localhost:3000
```

---

# **Running Tests**

## **Run Unit Tests**

```bash
npm test
```

## **Run Type Checking**

```bash
npm run typecheck
```

## **Build Project**

```bash
npm run build
```

---

# **Deployment Steps**

## **Run Remote Database Migration**

```bash
npm run db:migrate:remote
```

## **Deploy Application**

```bash
npm run deploy
```

---

# **Production Secrets Setup**

Set the following Worker secrets:

```bash
wrangler secret put CONTENT_KEY
wrangler secret put IP_HASH_SALT
wrangler secret put AI_GATEWAY_GOOGLE_API_KEY
wrangler secret put TURNSTILE_SECRET_KEY
```

---

# **Project Architecture**

The application follows a cloud-native serverless architecture using Cloudflare services:

* Frontend handled using React + Vinext
* Backend APIs served through Cloudflare Workers
* D1 database for structured data storage
* R2 bucket for file and media storage
* AI services integrated using Cloudflare AI and Google Gemini
* Browser Rendering API for PDF generation

---

# **Known Limitations**

* Vinext framework is currently experimental
* Tailwind CSS v4 is not fully compatible with Vinext
* Initial PDF rendering may take longer due to browser rendering initialization
* Workers Rate Limiting API supports only fixed time windows

---

# **Conclusion**

ProfAI v2 demonstrates the implementation of a modern AI-powered educational platform using serverless cloud technologies. The project combines AI tutoring, secure authentication, cloud storage, progress analytics, and PDF reporting into a scalable and interactive learning solution.
