#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "kami",
    version: "0.1.0",
    description:
      "Knowledge Agent Markdown Interface - AI-friendly personal knowledge base",
  },
  subCommands: {},
});

runMain(main);
