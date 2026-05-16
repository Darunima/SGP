import { WorkspaceMember, Task } from './supabase';

export interface MemberProfile {
  id: string;
  name: string;
  skillLevel: number; // 1-10
  availability: number; // 0-100 (percentage)
  tasksDone: number;
  tasksAverage: number;
  completionRate: number; // 0-100
}

/**
 * Generate an advanced AI prompt for intelligent task splitting
 * Analyzes project complexity, team capabilities, and creates balanced task distribution
 */
export function generateAdvancedAIPrompt(
  projectIdea: string,
  members: WorkspaceMember[],
  recentTasks?: Task[]
): string {
  // Calculate member profiles based on history
  const memberProfiles: Record<string, MemberProfile> = {};

  members.forEach((member, idx) => {
    // Estimate skill level from role (simplified)
    const skillLevel = member.role === 'owner' ? 9 : 7;

    // Calculate completion rate
    const completionRate = member.tasks_completed > 0
      ? Math.round((member.tasks_completed / (member.tasks_completed + member.tasks_pending)) * 100)
      : 0;

    memberProfiles[member.user_id] = {
      id: member.user_id,
      name: member.profile?.full_name || 'Member',
      skillLevel: Math.min(10, Math.max(1, skillLevel)),
      availability: 85, // Default availability (this would come from user preferences)
      tasksDone: member.tasks_completed,
      tasksAverage: Math.round((member.tasks_completed + member.tasks_pending) / Math.max(1, member.active_days)),
      completionRate: Math.min(100, completionRate),
    };
  });

  const memberList = Object.values(memberProfiles)
    .map((m, i) => `${i + 1}. ${m.name} - Skill: ${m.skillLevel}/10, Completion Rate: ${m.completionRate}%`)
    .join('\n');

  return `You are an expert project manager and AI task planning system. You excel at breaking down complex projects into perfectly balanced, achievable tasks for small teams.

IMPORTANT: You must respond with ONLY a valid JSON object, no other text, no markdown code blocks.

PROJECT DESCRIPTION:
${projectIdea}

TEAM MEMBERS (${Object.values(memberProfiles).length} people):
${memberList}

YOUR TASK:
1. Analyze the project complexity, required skills, and dependencies
2. Estimate total project timeline and workload
3. Identify potential risks and challenges
4. Create ${Math.max(Object.values(memberProfiles).length * 2, 8)} tasks that:
   - Are realistically achievable (1-10 days each)
   - Match team member skill levels
   - Cover all aspects of the project
   - Have clear dependencies where applicable
   - Are evenly distributed across the team
   - Include appropriate technologies and resources

5. Calculate project metrics:
   - Overall complexity (0-100)
   - Estimated timeline in days
   - Key risks
   - Team workload distribution

6. Define milestones (2-4 major checkpoints)

RETURN THIS JSON OBJECT (and ONLY this object):
{
  "analysis": {
    "complexity": <number 0-100>,
    "estimatedDays": <number>,
    "risks": [<string array of identified risks>],
    "recommendations": [<string array of recommendations to maximize success>],
    "milestones": [
      {
        "title": "<milestone name>",
        "tasks": [<array of task titles for this milestone>],
        "deadline": <day number>
      }
    ],
    "workloadDistribution": {
      "${Object.entries(memberProfiles)
        .map(([id, m]) => `"${id}": <expected number of tasks>`)
        .join(', ')}
    }
  },
  "tasks": [
    {
      "title": "<clear, actionable task title>",
      "description": "<detailed description of what needs to be done>",
      "category": "<one of: frontend, backend, database, ai_ml, documentation, general, devops, design>",
      "estimated_days": <1-10>,
      "assigned_to": "<member id to assign to - choose based on skill match>",
      "technologies": [<relevant tech stack>],
      "resources": [<helpful links/documentation>],
      "dependencies": [<titles of tasks this depends on, leave empty if none>],
      "priority": "<low|medium|high>"
    }
  ]
}

REMEMBER:
- Distribute tasks evenly to avoid overloading anyone
- Match task complexity to member skill levels
- Set realistic timelines
- Consider team velocity and experience
- All tasks must be actionable and measurable
- Return ONLY the JSON, no explanations`;
}

/**
 * Parse AI response and extract analysis and tasks
 */
export function parseAIResponse(response: string): {
  analysis: any;
  tasks: any[];
} | null {
  try {
    // Extract JSON from response (in case it has extra text)
    let jsonStr = response;

    // Try to find JSON object in response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    return {
      analysis: parsed.analysis || {},
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    };
  } catch {
    console.error('Failed to parse AI response:', response);
    return null;
  }
}

/**
 * Calculate task priorities based on analysis
 */
export function calculateTaskPriorities(
  tasks: any[],
  analysis: any
): Array<{ task: any; priority: 'critical' | 'high' | 'medium' | 'low' }> {
  return tasks.map(task => {
    let priority: 'critical' | 'high' | 'medium' | 'low' = 'medium';

    // Tasks without dependencies are critical
    if (!task.dependencies || task.dependencies.length === 0) {
      priority = 'critical';
    }

    // Frontend/backend tasks are high priority
    if (['frontend', 'backend'].includes(task.category)) {
      priority = priority === 'critical' ? 'critical' : 'high';
    }

    // Consider explicit priority from AI
    if (task.priority === 'high') {
      priority = priority === 'critical' ? 'critical' : 'high';
    } else if (task.priority === 'low') {
      priority = 'low';
    }

    return { task, priority };
  });
}
