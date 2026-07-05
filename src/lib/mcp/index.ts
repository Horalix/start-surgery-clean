import { defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";

export default defineMcp({
  name: "surgery-mcp",
  title: "Surgery MCP",
  version: "0.1.0",
  instructions: "Tools for the Surgery app. Use `echo` to verify connectivity.",
  tools: [echoTool],
});
