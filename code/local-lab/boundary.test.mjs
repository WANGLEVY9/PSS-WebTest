import test from "node:test";
import assert from "node:assert/strict";
import { createVolcengineCuaDriver } from "../src/arms/volcengine-cua-driver.mjs";
import { createVolcengineHybridDriver } from "../src/arms/volcengine-hybrid-driver.mjs";
for (const arm of ["visual", "hybrid"])
  test(`${arm} generic prompt excludes legacy editor instructions`, async () => {
    let body;
    const options = {
      env: {
        CUA_PROVIDER: "aliyun",
        CUA_MODEL: "qwen3.7-flash",
        CUA_API_KEY: "test-only",
        PSS_PROMPT_PROFILE: "generic-web-v1",
      },
      executeAction: async () => {},
      fetchImpl: async (_url, init) => {
        body = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      function: {
                        name: "ui_action",
                        arguments: '{"action_type":"done","verdict":"pass"}',
                      },
                    },
                  ],
                },
              },
            ],
          }),
        };
      },
    };
    const driver =
      arm === "visual"
        ? createVolcengineCuaDriver({
            ...options,
            observeScreenshot: async () => "abc",
          })
        : createVolcengineHybridDriver({
            ...options,
            observeHybrid: async () => ({
              screenshot: "abc",
              pageStructure: { controls: [] },
            }),
          });
    await driver.decide({
      intent: "Search apple",
      observation: await driver.observe(),
      step: 0,
    });
    assert.equal(body.presence_penalty, 0);
    const text = body.messages[0].content[0].text;
    assert.doesNotMatch(text, /Page Title|content editor|oracle|localhost/);
    if (arm === "visual") {
      assert.equal(
        body.tools[0].function.parameters.properties.target_id,
        undefined,
      );
      assert.doesNotMatch(text, /Visible controls/);
    } else assert.match(text, /observation-local/);
  });
