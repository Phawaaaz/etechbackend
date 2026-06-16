import { Router } from "express";

const router = Router();

const SUBJECTS = [
  {
    id: "computer-science",
    name: "Computer Science",
    topics: [
      "Data Structures & Algorithms",
      "Machine Learning",
      "Deep Learning",
      "Computer Networks",
      "Operating Systems",
      "Database Systems",
      "Software Engineering",
      "Cybersecurity",
      "Cloud Computing",
      "Web Development",
      "Mobile Development",
      "Computer Architecture",
      "Compilers & Programming Languages",
      "Distributed Systems",
      "Artificial Intelligence",
    ],
  },
  {
    id: "mathematics",
    name: "Mathematics",
    topics: [
      "Linear Algebra",
      "Calculus",
      "Discrete Mathematics",
      "Probability & Statistics",
      "Number Theory",
      "Abstract Algebra",
      "Real Analysis",
      "Differential Equations",
      "Numerical Methods",
      "Graph Theory",
    ],
  },
  {
    id: "physics",
    name: "Physics",
    topics: [
      "Classical Mechanics",
      "Quantum Mechanics",
      "Thermodynamics",
      "Electromagnetism",
      "Optics",
      "Relativity",
      "Nuclear Physics",
      "Astrophysics",
      "Solid State Physics",
      "Particle Physics",
    ],
  },
  {
    id: "biology",
    name: "Biology",
    topics: [
      "Cell Biology",
      "Genetics & DNA",
      "Evolution",
      "Ecology",
      "Human Anatomy",
      "Microbiology",
      "Biochemistry",
      "Neuroscience",
      "Immunology",
      "Molecular Biology",
    ],
  },
  {
    id: "chemistry",
    name: "Chemistry",
    topics: [
      "Organic Chemistry",
      "Inorganic Chemistry",
      "Physical Chemistry",
      "Analytical Chemistry",
      "Biochemistry",
      "Electrochemistry",
      "Thermochemistry",
      "Polymer Chemistry",
    ],
  },
  {
    id: "economics",
    name: "Economics",
    topics: [
      "Microeconomics",
      "Macroeconomics",
      "Behavioral Economics",
      "Game Theory",
      "International Economics",
      "Development Economics",
      "Financial Economics",
      "Econometrics",
    ],
  },
  {
    id: "history",
    name: "History",
    topics: [
      "Ancient Civilizations",
      "World War I",
      "World War II",
      "The Cold War",
      "The Industrial Revolution",
      "African History",
      "Asian History",
      "European History",
      "History of Science",
    ],
  },
];

/**
 * @openapi
 * /api/subjects:
 *   get:
 *     tags: [Subjects]
 *     summary: List all available subjects
 *     responses:
 *       200:
 *         description: Array of subjects with their topic lists.
 */
router.get("/", (req, res) => {
  res.json({ success: true, data: { subjects: SUBJECTS.map(({ id, name }) => ({ id, name })) } });
});

/**
 * @openapi
 * /api/subjects/{id}/topics:
 *   get:
 *     tags: [Subjects]
 *     summary: Get topics for a specific subject
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: computer-science
 *     responses:
 *       200:
 *         description: List of topics.
 *       404:
 *         description: Subject not found.
 */
router.get("/:id/topics", (req, res) => {
  const subject = SUBJECTS.find((s) => s.id === req.params.id);
  if (!subject) {
    return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Subject '${req.params.id}' not found. GET /api/subjects for the full list.` } });
  }
  res.json({ success: true, data: { subject: subject.name, topics: subject.topics } });
});

export default router;
