#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import init from "./commands/init.ts";
import create from "./commands/create.ts";
import read from "./commands/read.ts";
import edit from "./commands/edit.ts";
import del from "./commands/delete.ts";
import list from "./commands/list.ts";
import searchCmd from "./commands/search.ts";
import links from "./commands/links.ts";
import backlinks from "./commands/backlinks.ts";
import template from "./commands/template.ts";
import exportCmd from "./commands/export.ts";

const main = defineCommand({
  meta: {
    name: "kami",
    version: "0.1.0",
    description:
      "Knowledge Agent Markdown Interface - AI-friendly personal knowledge base",
  },
  subCommands: {
    init,
    create,
    read,
    edit,
    delete: del,
    list,
    search: searchCmd,
    links,
    backlinks,
    template,
    export: exportCmd,
  },
});

runMain(main);
