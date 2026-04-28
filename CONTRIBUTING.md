# Contributing

This is a personal project shared with a small closed beta group. I'm
not accepting code contributions or pull requests — please don't open
one. What I do want is bug reports and feedback on the questions listed
in the [README](README.md). To file a bug, Whatsapp or iMessage me directly at
+61 416 168 213 with: what you did, what you expected,
what happened, and (if it matters) a snippet of the dev-server log.
One bug per message is easier to triage than a catch-all essay.

## Change discipline

Changes should land phase by phase. Keep each commit focused on code,
docs, or assets that someone needs to run the app from the repo. Do not
commit local audit plans, private notes, `.env` files, SQLite databases,
or customer/prospect data.

Before sharing a change or treating it as ready, run a smoke test of the
affected workflow. For most changes that means starting the app, opening
the relevant screen, performing the changed action once, and confirming
there is no obvious regression. Larger product phases should also pass
typecheck, build, and any available tests before going live.
