export const generateImageUrl = (prompt) => {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=800&height=600&nologo=true`;
};
