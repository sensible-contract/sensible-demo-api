import { SensiblequeryProvider } from "@sensible-contract/providers";
import { LocalWallet } from "@sensible-contract/wallets";
import { ParameterizedContext } from "koa";
import { body, prefix, request, summary, tags } from "koa-swagger-decorator";
import { Sensible } from "../sensible-utils";

const tag = tags(["Token"]);

@prefix("/token")
export default class TokenRouter {
  @request("post", "/transfer")
  @summary("token controller transfer")
  @tag
  @body({
    wif: { type: "string", required: true },
    token: {
      type: "object",
      properties: {
        codehash: { type: "string", required: true },
        genesis: { type: "string", required: true },
      },
      required: true,
    },
    receivers: {
      type: "array",
      required: true,
      items: {
        type: "object",
        required: true,
        properties: {
          address: { type: "string" },
          amount: { type: "string" },
        },
      },
    },
    opreturnData: { type: "string", required: false, example: "" },
  })
  async transfer(ctx: ParameterizedContext) {
    const { wif, token, receivers, opreturnData } = ctx.validatedBody as any;

    let provider = new SensiblequeryProvider();
    let wallet = LocalWallet.fromWIF(wif);
    let sensible = new Sensible(provider, wallet);
    let { txids } = await sensible.transferToken({
      token,
      receivers,
      opreturnData,
    });
    ctx.body = {
      txids,
    };
  }
}
