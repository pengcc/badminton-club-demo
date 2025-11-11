# 🏸 Badminton Club Website — AI-Assisted Refactor

As AI technology rapidly evolves, a variety of powerful development tools have emerged. To explore and experience different **AI-assisted programming workflows**, we decided to **rebuild our badminton club’s website**.

---

## 🧰 Tools and Process

### 🖥️ Homepage UI Creation
The homepage UI was generated using [**Sider Web Creator**](https://sider.ai/de/agents/web-creator).
The experience was **fast and smooth**, and we were quite satisfied with the result.

---

### 💻 Initial Coding with Qoder
We experimented with [**Qoder**](https://qoder.com/) for **vibe coding**.
It successfully generated a **basic working project**, but the **code quality was mediocre** — roughly **90% of it was later refactored**.

---

### 🔧 Refactoring and SDD Workflow
To improve maintainability and code quality, we adopted the **Spec-Driven Development (SDD)** approach via [**OpenSpec**](https://github.com/Fission-AI/OpenSpec).
Using **VS Code Copilot (Claude Sonnet)** as our main AI agent, we refactored the entire codebase with promising results.

However, we observed a few limitations:
- The Agent sometimes **repeated identical mistakes**, requiring **manual correction**.
- To achieve meaningful optimizations, **very precise prompts** were necessary.
- General principles like **DRY (Don’t Repeat Yourself)** were not automatically applied.
- In **frontend code (Next.js)**, the Agent did not proactively extract reusable logic into shared components unless explicitly instructed.
- Similarly, other optimization patterns required **explicit and detailed requests**.

---

## 🧩 Project Architecture
For detailed information about the system architecture, please refer to [**openspec/ARCHITECTURE.md**](openspec/ARCHITECTURE.md).
It outlines the project structure, key modules, and the interaction flow between frontend and backend components.

---

## ✨ Key Features

### 🗄️ Dual Storage Mode
The application supports two operational modes to provide instant access while maintaining full-stack demonstration capabilities:

- **Local Mode (Default)**: Browser-based storage using IndexedDB for instant access without server dependencies
- **Server Mode**: Traditional full-stack operation with backend API and MongoDB Atlas

**Why?** Free-tier hosting platforms (like Render) can take 10-20 minutes to wake up from sleep. Local mode provides instant access for portfolio visitors while maintaining the option to explore the full backend implementation.

**Documentation**: See [**docs/LOCAL_STORAGE_MODE.md**](docs/LOCAL_STORAGE_MODE.md) for technical details, architecture, and maintenance guide.

**Key Technologies**:
- Adapter Pattern for unified data access
- Dexie.js for IndexedDB operations
- React Query for state management
- Separate route trees for clean auth isolation

---

### 🚀 Future Plans
We plan to experiment with **MCP** and **Claude Code Skills**, which may offer a more advanced and stable AI-assisted development experience.

Looking ahead, it would be exciting to see **specialized Agents** emerge —
for example:
- Agents focused on **Web Full-Stack Development**
- Agents tailored to **React / Vue** front-end frameworks
- Agents specialized in **Node.js** backend development

Such agents could be **smaller, faster, and more efficient**, providing more reliable assistance for real-world engineering workflows.

---

## 📄 License
This project is for **educational and experimental purposes**.
Feel free to explore and adapt it for your own AI-assisted workflows.
