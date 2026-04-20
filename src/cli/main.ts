import { defineCommand } from "citty";
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
import vault from "./commands/vault.ts";
import help from "./commands/help.ts";
import batch from "./commands/batch.ts";
import recent from "./commands/recent.ts";
import similar from "./commands/similar.ts";
import tag from "./commands/tag.ts";
import move from "./commands/move.ts";

export const main = defineCommand({
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
    vault,
    help,
    batch,
    recent,
    similar,
    tag,
    move,
  },
});
