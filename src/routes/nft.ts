import { SensiblequeryProvider } from "@sensible-contract/providers";
import { LocalWallet } from "@sensible-contract/wallets";
import { ParameterizedContext } from "koa";
import { body, prefix, request, summary, tags } from "koa-swagger-decorator";
import { Sensible } from "../sensible-utils";

const tag = tags(["Nft"]);

@prefix("/nft")
export default class NftRouter {
  @request("post", "/transfer")
  @summary("nft controller transfer")
  @tag
  @body({
    wif: { type: "string", required: true },
    nft: {
      type: "object",
      properties: {
        codehash: { type: "string", required: true },
        genesis: { type: "string", required: true },
        tokenIndex: { type: "string", required: true },
      },
      required: true,
    },
    receiverAddress: { type: "string", required: true },
    opreturnData: { type: "string", required: false, example: "" },
  })
  async transfer(ctx: ParameterizedContext) {
    const { wif, nft, receiverAddress, opreturnData } =
      ctx.validatedBody as any;

    let provider = new SensiblequeryProvider();
    let wallet = LocalWallet.fromWIF(wif);
    let sensible = new Sensible(provider, wallet);
    let { txid } = await sensible.transferNft({
      nft,
      receiverAddress,
      opreturnData,
    });
    ctx.body = {
      txid,
    };
  }
}
