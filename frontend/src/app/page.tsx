import fs from 'fs';
import path from 'path';
import HomePageClient from './HomePageClient'; // Import the new client component

// This function runs on the server to read file content
function getMarkdownContent() {
  // Ensure the path is correct, process.cwd() points to the project root
  const filePath = path.join(process.cwd(), 'content', 'project-description.md');
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return fileContent;
  } catch (error) {
    console.error("Failed to read Markdown file:", error);
    return "## Failed to load description\n\nPlease check if `content/project-description.md` exists.";
  }
}

// This is our homepage server component
export default function HomePage() {
  // 1. Get data on the server
  const markdownContent = getMarkdownContent();

  // 2. Pass data as prop to client component for rendering
  return <HomePageClient markdownContent={markdownContent} />;
}