/**
 * Knowledge-base grounding module.
 *
 * Retrieves relevant context from the IBM Watson Discovery
 * vector index named "Interview_Agent", then prepends it as
 * a system message so Granite is always grounded in the docs.
 *
 * If Watson Discovery is not configured / reachable,
 * the module falls back to built-in knowledge snippets so
 * the app remains functional.
 */
const axios = require("axios");

const DISCOVERY_URL = process.env.WATSON_DISCOVERY_URL;
const DISCOVERY_VERSION = process.env.WATSON_DISCOVERY_VERSION || "2023-03-31";
const DISCOVERY_PROJECT_ID = process.env.WATSON_DISCOVERY_PROJECT_ID;

// ---------- built-in fallback knowledge snippets ----------
const FALLBACK_KNOWLEDGE = {
  software_engineer: `
## Software Engineer Interview Knowledge
### Technical Topics
- Data Structures: Arrays, Linked Lists, Trees, Graphs, Hash Maps, Heaps
- Algorithms: Sorting (QuickSort O(n log n), MergeSort), Searching (Binary Search O(log n)), Dynamic Programming, BFS/DFS
- System Design: Load balancers, Caching (Redis/Memcached), Database sharding, CAP theorem, Microservices vs Monolith
- OOP Principles: SOLID, Design Patterns (Singleton, Factory, Observer, Strategy)
- Complexity: Big-O notation, time/space trade-offs

### Common Interview Patterns (Google/Meta/Amazon/TCS/Infosys)
- Two Pointers, Sliding Window, Fast & Slow Pointers
- Tree traversals (inorder, preorder, postorder)
- Graph algorithms (Dijkstra, Bellman-Ford)
- Dynamic programming (Knapsack, LCS, LIS)

### Behavioral (STAR Framework)
- Leadership, Conflict resolution, Failure & Recovery
- Cross-functional collaboration, Tight deadlines

### Company Specific
**TCS:** Focus on basic DS, SQL, OOP, verbal communication
**Infosys:** Logical reasoning + coding + HR rounds
**Google:** 4-6 coding rounds, system design, Googleyness
**Amazon:** 14 Leadership Principles, bar raiser concept
**Microsoft:** Problem-solving mindset, growth mentality
`,
  data_scientist: `
## Data Scientist Interview Knowledge
### Core ML Topics
- Supervised: Linear/Logistic Regression, Decision Trees, Random Forest, SVM, Neural Networks
- Unsupervised: K-Means, DBSCAN, PCA, t-SNE
- Evaluation: Precision, Recall, F1, AUC-ROC, RMSE, MAE
- Regularization: L1 (Lasso), L2 (Ridge), Dropout
- Bias-Variance tradeoff, Overfitting/Underfitting

### Statistics
- Central Limit Theorem, Hypothesis testing, p-values, Confidence intervals
- Bayes' Theorem, Probability distributions

### Tools & Frameworks
- Python (pandas, numpy, scikit-learn, TensorFlow/PyTorch)
- SQL for data wrangling
- Feature engineering, EDA best practices

### Company Specific
**IBM:** Focus on Watson AI, responsible AI, IBM Cloud tools
**Google:** ML system design, TFX pipelines
**Amazon:** A/B testing at scale, recommendation systems
`,
  frontend_developer: `
## Frontend Developer Interview Knowledge
### Core JavaScript
- Closures, Hoisting, Event Loop, Promises, async/await
- Prototype chain, 'this' keyword, Arrow functions
- ES6+: Destructuring, Spread, Rest, Generators

### React/Vue/Angular
- React: Hooks (useState, useEffect, useCallback, useMemo), Virtual DOM, Reconciliation
- State management: Redux, Context API, Zustand
- Performance: Code splitting, Lazy loading, memoization

### CSS & Web
- Flexbox, CSS Grid, Responsive design, BEM methodology
- Browser rendering pipeline, Repaint vs Reflow
- Accessibility (ARIA), SEO basics

### Common Interview Questions
- Explain event delegation
- Difference between == and ===
- How does React's reconciliation algorithm work?
- What is CORS and how to handle it?
`,
  backend_developer: `
## Backend Developer Interview Knowledge
### APIs & Architecture
- REST principles, HTTP methods, Status codes
- GraphQL vs REST, gRPC
- Authentication: JWT, OAuth2, Session cookies

### Databases
- SQL: Joins, Indexes, Transactions, ACID, N+1 problem
- NoSQL: Document (MongoDB), Key-value (Redis), Column (Cassandra)
- Query optimization, Explain plans

### Node.js / Java / Python
- Event loop (Node.js), Threading models
- Spring Boot, Express.js patterns
- Microservices, Message queues (Kafka, RabbitMQ)

### DevOps & Cloud
- Docker, Kubernetes basics
- CI/CD pipelines
- AWS/GCP/Azure core services
`,
  general: `
## General Software Interview Knowledge
### Universal Topics
- Problem decomposition, Pseudocode clarity
- Time & Space complexity analysis
- Clean code principles (DRY, KISS, SOLID)
- Testing: Unit, Integration, E2E
- Git workflow, Code review best practices

### Soft Skills
- Communication of technical ideas to non-technical stakeholders
- Handling ambiguity, asking clarifying questions
- Estimation and planning under constraints
`,
};

/**
 * Retrieve grounding context from Watson Discovery OR fallback.
 * @param {string} query   - search query derived from user input
 * @param {string} role    - job role keyword for fallback selection
 * @returns {string}       - context text to inject into system prompt
 */
async function retrieveContext(query, role = "general") {
  // Try Watson Discovery first
  if (DISCOVERY_URL && DISCOVERY_PROJECT_ID) {
    try {
      const token = await require("./graniteClient").getIAMToken();
      const resp = await axios.post(
        `${DISCOVERY_URL}/v2/projects/${DISCOVERY_PROJECT_ID}/query?version=${DISCOVERY_VERSION}`,
        {
          query: query,
          passages: { enabled: true, max_per_document: 3, find_answers: true },
          count: 5,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      const results = resp.data?.results || [];
      if (results.length > 0) {
        const passages = results
          .flatMap((r) => r.document_passages || [])
          .slice(0, 8)
          .map((p) => p.passage_text)
          .filter(Boolean)
          .join("\n\n---\n\n");
        if (passages.length > 100) return passages;
      }
    } catch (err) {
      console.warn("[KnowledgeBase] Watson Discovery unavailable, using fallback:", err.message);
    }
  }

  // Fallback: select best matching built-in snippet
  const lowerRole = (role + " " + query).toLowerCase();
  if (lowerRole.includes("data sci") || lowerRole.includes("ml") || lowerRole.includes("machine learning")) {
    return FALLBACK_KNOWLEDGE.data_scientist;
  }
  if (lowerRole.includes("front") || lowerRole.includes("react") || lowerRole.includes("vue") || lowerRole.includes("angular")) {
    return FALLBACK_KNOWLEDGE.frontend_developer;
  }
  if (lowerRole.includes("back") || lowerRole.includes("node") || lowerRole.includes("java") || lowerRole.includes("api")) {
    return FALLBACK_KNOWLEDGE.backend_developer;
  }
  if (lowerRole.includes("software") || lowerRole.includes("sde") || lowerRole.includes("developer") || lowerRole.includes("engineer")) {
    return FALLBACK_KNOWLEDGE.software_engineer;
  }
  return FALLBACK_KNOWLEDGE.general + "\n\n" + FALLBACK_KNOWLEDGE.software_engineer;
}

module.exports = { retrieveContext };
