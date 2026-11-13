import { assert, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { threadLinkAppUrlConfig } from "./publicConfig.ts";

const provideEnv = (env: Readonly<Record<string, string>>) =>
  Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env })));

it.effect(
  "thread links for outside MCP clients need an explicit hosted app, never default to app.up.computer",
  () =>
    Effect.gen(function* () {
      assert.isTrue(Option.isNone(yield* threadLinkAppUrlConfig.pipe(provideEnv({}))));
      assert.deepEqual(
        yield* threadLinkAppUrlConfig.pipe(
          provideEnv({ T3CODE_HOSTED_APP_URL: "https://hosted.example.test" }),
        ),
        Option.some("https://hosted.example.test"),
      );
    }),
);
