FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install the published MCP server package
RUN npm install -g @agent-receipts/mcp-server@0.4.0

# Create data directory for receipts
RUN mkdir -p /root/.agent-receipts

# Set environment variables
ENV AGENT_RECEIPTS_AGENT_ID=glama-agent
ENV AGENT_RECEIPTS_ORG_ID=glama-org
ENV AGENT_RECEIPTS_ENVIRONMENT=production

# Expose stdio — MCP servers communicate via stdio
CMD ["agent-receipts-server"]
