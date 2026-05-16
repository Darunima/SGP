import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Member = { id: string; name: string };

interface RequestBody {
  projectIdea: string;
  members: Member[];
  promptOverride?: string; // Add this
}

interface AITask {
  title: string;
  description: string;
  category: string;
  estimated_days: number;
  assigned_to: string;
  technologies: string[];
  resources: string[];
}

const CATEGORIES = ['frontend', 'backend', 'database', 'ai_ml', 'documentation', 'general', 'devops', 'design'];

function buildPrompt(projectIdea: string, members: Member[]): string {
  return `You are a senior software architect and project manager for a student hackathon team.
Analyze this project idea and split it into realistic, balanced tasks for the team.

PROJECT IDEA: ${projectIdea}

TEAM MEMBERS (${members.length} people):
${members.map((m, i) => `${i + 1}. ${m.name} (id: ${m.id})`).join('\n')}

Generate exactly ${Math.max(members.length * 2, 6)} tasks that:
1. Cover all aspects of the project (frontend, backend, database, AI/ML if applicable, docs)
2. Are fairly distributed among team members
3. Each task should be achievable in 1-7 days
4. Include specific technology suggestions
5. Include helpful learning resources as URLs

Return ONLY a valid JSON array with this exact structure:
[
  {
    "title": "Task title (short, action-oriented)",
    "description": "Detailed description of what needs to be done, acceptance criteria, and approach",
    "category": "one of: frontend|backend|database|ai_ml|documentation|general|devops|design",
    "estimated_days": 3,
    "assigned_to": "${members[0]?.id || 'member-id'}",
    "technologies": ["React", "TypeScript"],
    "resources": ["https://reactjs.org/docs", "https://www.typescriptlang.org/docs/"]
  }
]

Distribute tasks evenly. Return ONLY the JSON array, no markdown, no explanation.`;
}

function getFallbackTasks(projectIdea: string, members: Member[]): AITask[] {
  const taskTemplates = [
    { title: "Setup Project Structure & Boilerplate", category: "general", description: "Initialize the project repository, configure build tools, set up linting/formatting, and establish folder structure following best practices.", estimated_days: 1, technologies: ["Git", "Node.js", "ESLint", "Prettier"], resources: ["https://vitejs.dev/guide/"] },
    { title: "Design UI/UX Wireframes & Design System", category: "design", description: "Create wireframes for all key screens, establish color palette, typography, and component library.", estimated_days: 2, technologies: ["Figma", "Tailwind CSS"], resources: ["https://tailwindcss.com/docs"] },
    { title: "Implement Authentication System", category: "backend", description: "Set up user registration, login, logout with JWT tokens and session management.", estimated_days: 3, technologies: ["Firebase Auth", "React"], resources: ["https://firebase.google.com/docs/auth"] },
    { title: "Build Database Schema & Models", category: "database", description: "Design and implement the database schema, create data models, set up relationships and indexes.", estimated_days: 2, technologies: ["Supabase", "PostgreSQL"], resources: ["https://supabase.com/docs"] },
    { title: "Develop Core Frontend Components", category: "frontend", description: "Build reusable UI components including navigation, forms, cards, and layouts.", estimated_days: 4, technologies: ["React", "TypeScript", "Tailwind CSS"], resources: ["https://react.dev"] },
    { title: "Create REST API Endpoints", category: "backend", description: "Implement all required API endpoints with proper validation, error handling, and documentation.", estimated_days: 3, technologies: ["Node.js", "Express", "REST API"], resources: ["https://expressjs.com"] },
    { title: "Write Project Documentation", category: "documentation", description: "Write comprehensive README, API documentation, setup guide, and deployment instructions.", estimated_days: 1, technologies: ["Markdown", "Swagger"], resources: ["https://swagger.io/docs/"] },
    { title: "Testing & Quality Assurance", category: "general", description: "Write unit tests, integration tests, and perform end-to-end testing to ensure quality.", estimated_days: 2, technologies: ["Jest", "Testing Library"], resources: ["https://jestjs.io/docs/getting-started"] },
  ];

  return taskTemplates.slice(0, Math.max(members.length * 2, 6)).map((t, i) => ({
    ...t,
    assigned_to: members[i % members.length]?.id || '',
  }));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { projectIdea, members, promptOverride } = body; // Destructure promptOverride

    if (!projectIdea?.trim() || !members?.length) {
      return new Response(JSON.stringify({ error: "Missing projectIdea or members" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!geminiApiKey && !openaiApiKey) throw new Error("Missing AI API keys (GEMINI or OPENAI)");

    let promptToUse = promptOverride || buildPrompt(projectIdea, members); // Use override if provided

    let tasks: AITask[] = [];

    if (geminiApiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptToUse }] }], // Use promptToUse
              generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
            }),
          }
        );

        if (!response.ok) {
          const err = await response.text();
          console.error("Gemini API Error:", err);
          throw new Error(`Gemini API returned status ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) tasks = JSON.parse(jsonMatch[0]);
      } catch (err) {
        console.error("Gemini processing error:", err);
        tasks = [];
      }
    } else if (openaiApiKey) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              { role: "system", content: "You are a senior software architect. Always respond with valid JSON arrays only." },
              { role: "user", content: promptToUse }, // Use promptToUse
            ],
            temperature: 0.7, max_tokens: 4096,
          }),
        });
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) tasks = JSON.parse(jsonMatch[0]);
      } catch {
        tasks = [];
      }
    }

    if (!tasks.length) {
      tasks = getFallbackTasks(projectIdea, members);
    }

    // Validate and sanitize tasks
    const validCategories = CATEGORIES;
    const sanitized = tasks.map(t => ({
      title: String(t.title || "Task").slice(0, 200),
      description: String(t.description || "").slice(0, 2000),
      category: validCategories.includes(t.category) ? t.category : "general",
      estimated_days: Math.max(1, Math.min(30, Number(t.estimated_days) || 3)),
      assigned_to: members.find(m => m.id === t.assigned_to)?.id || members[0]?.id || "",
      technologies: Array.isArray(t.technologies) ? t.technologies.slice(0, 8).map(String) : [],
      resources: Array.isArray(t.resources) ? t.resources.slice(0, 5).map(String) : [],
    }));

    return new Response(JSON.stringify({ tasks: sanitized }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});