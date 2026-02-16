#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import pkg from "../../package.json";
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
import reindex from "./commands/reindex.ts";
import build from "./commands/build.ts";
import serve from "./commands/serve.ts";
import install from "./commands/install.ts";

const main = defineCommand({
  meta: {
    name: "kami",
    version: pkg.version,
    description: pkg.description,
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
    reindex,
    build,
    serve,
    install,
  },
});

runMain(main);
