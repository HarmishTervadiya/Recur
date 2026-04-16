import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import assert from "assert";
import type { Recur } from "../target/types/recur";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  approve,
} from "@solana/spl-token";

describe("recur", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Recur as Program<Recur>;

  const INTERVAL = new anchor.BN(2);
  const AMOUNT = new anchor.BN(1000 * 10 ** 6);
  const mintAuthority = anchor.web3.Keypair.generate();
  const keeper = anchor.web3.Keypair.generate();

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const airdropAndConfirm = async (pubkey: anchor.web3.PublicKey, sol = 2) => {
    const signature = await provider.connection.requestAirdrop(
      pubkey,
      sol * anchor.web3.LAMPORTS_PER_SOL,
    );
    const latest = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
      signature,
    });
  };

  const waitForInterval = async (seconds: number) => {
    await sleep((seconds + 1) * 1000);
    // Push at least one confirmed tx so local validator clock-dependent checks advance.
    await airdropAndConfirm(anchor.web3.Keypair.generate().publicKey, 1);
  };

  const setupSubscription = async (interval = INTERVAL) => {
    const subscriber = anchor.web3.Keypair.generate();
    const merchant = anchor.web3.Keypair.generate();

    await airdropAndConfirm(subscriber.publicKey, 2);
    await airdropAndConfirm(merchant.publicKey, 2);

    const mintAddress = await createMint(
      provider.connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      6,
    );

    const subscriberAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      subscriber,
      mintAddress,
      subscriber.publicKey,
    );

    const merchantAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      merchant,
      mintAddress,
      merchant.publicKey,
    );

    await mintTo(
      provider.connection,
      mintAuthority,
      mintAddress,
      subscriberAccount.address,
      mintAuthority,
      1000 * 10 ** 6,
    );

    const [subscriptionPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("subscription"),
        subscriber.publicKey.toBuffer(),
        merchant.publicKey.toBuffer(),
      ],
      program.programId,
    );

    await approve(
      provider.connection,
      subscriber,
      subscriberAccount.address,
      subscriptionPda,
      subscriber,
      AMOUNT.toNumber(),
    );

    await program.methods
      .initializeSubscription(AMOUNT, interval)
      .accounts({
        subscriber: subscriber.publicKey,
        merchant: merchant.publicKey,
      })
      .signers([subscriber, merchant])
      .rpc();

    return {
      subscriber,
      merchant,
      mintAddress,
      subscriberAta: subscriberAccount.address,
      merchantAta: merchantAccount.address,
      subscriptionPda,
      interval,
    };
  };

  before(async () => {
    await airdropAndConfirm(mintAuthority.publicKey, 2);
    await airdropAndConfirm(keeper.publicKey, 2);
  });

  it("initializes a subscription", async () => {
    const { subscriber, merchant, subscriptionPda } = await setupSubscription();

    const sub = await program.account.subscription.fetch(subscriptionPda);
    assert.equal(sub.subscriber.toBase58(), subscriber.publicKey.toBase58());
    assert.equal(sub.merchant.toBase58(), merchant.publicKey.toBase58());
    assert.equal(sub.amount.toString(), AMOUNT.toString());
    assert.equal(sub.interval.toString(), INTERVAL.toString());
    assert.equal(sub.cancelRequestedAt.toString(), "0");
    assert.equal(typeof sub.bump, "number");
  });

  it("processes a payment after interval", async () => {
    const {
      subscriber,
      merchant,
      mintAddress,
      subscriberAta,
      merchantAta,
      subscriptionPda,
      interval,
    } = await setupSubscription();

    const beforeMerchant = BigInt(
      (await provider.connection.getTokenAccountBalance(merchantAta)).value
        .amount,
    );
    const beforeSub = await program.account.subscription.fetch(subscriptionPda);

    await waitForInterval(interval.toNumber());

    await program.methods
      .processPayment()
      .accounts({
        subscription: subscriptionPda,
        subscriber: subscriber.publicKey,
        merchant: merchant.publicKey,
        subscriberTokenAccount: subscriberAta,
        merchantTokenAccount: merchantAta,
        mint: mintAddress,
        keeper: keeper.publicKey,
      })
      .signers([keeper])
      .rpc();

    const afterMerchant = BigInt(
      (await provider.connection.getTokenAccountBalance(merchantAta)).value
        .amount,
    );
    assert.equal(afterMerchant - beforeMerchant, BigInt(AMOUNT.toString()));

    const afterSub = await program.account.subscription.fetch(subscriptionPda);
    assert.ok(
      Number(afterSub.lastPaymentTimestamp) >=
        Number(beforeSub.lastPaymentTimestamp),
      "last_payment_timestamp should move forward after successful payment",
    );
  });

  it("blocks payment before interval", async () => {
    const {
      subscriber,
      merchant,
      mintAddress,
      subscriberAta,
      merchantAta,
      subscriptionPda,
    } = await setupSubscription(new anchor.BN(60));

    let threw = false;
    try {
      await program.methods
        .processPayment()
        .accounts({
          subscription: subscriptionPda,
          subscriber: subscriber.publicKey,
          merchant: merchant.publicKey,
          subscriberTokenAccount: subscriberAta,
          merchantTokenAccount: merchantAta,
          mint: mintAddress,
          keeper: keeper.publicKey,
        })
        .signers([keeper])
        .rpc();
    } catch (e) {
      threw = true;
      const message = String(e);
      assert.ok(
        message.includes("BillingIntervalNotReached") ||
          message.includes("6002"),
        `expected BillingIntervalNotReached, got: ${message}`,
      );
    }

    assert.ok(threw, "expected process_payment to fail before interval");
  });

  it("request and finalize cancel", async () => {
    const { subscriber, merchant, subscriptionPda, interval } =
      await setupSubscription();

    await program.methods
      .requestCancel()
      .accounts({
        subscription: subscriptionPda,
        authority: subscriber.publicKey,
        subscriber: subscriber.publicKey,
        merchant: merchant.publicKey,
      })
      .signers([subscriber])
      .rpc();

    const afterRequest =
      await program.account.subscription.fetch(subscriptionPda);
    assert.notEqual(afterRequest.cancelRequestedAt.toString(), "0");

    await waitForInterval(interval.toNumber());

    await program.methods
      .finalizeCancel()
      .accounts({
        subscription: subscriptionPda,
        subscriber: subscriber.publicKey,
        merchant: merchant.publicKey,
      })
      .rpc();

    const closed =
      await program.account.subscription.fetchNullable(subscriptionPda);
    assert.equal(closed, null);
  });
});
