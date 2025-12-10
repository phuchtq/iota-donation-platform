module fundraising::fundraising;

use iota::coin::{Self, Coin};
use iota::iota::IOTA;

public struct Campaign has key {
    id: UID,
    name: vector<u8>,
    description: vector<u8>,
    admin: address,
    total_donated: u64,
    funds: Coin<IOTA>,
    active: bool,
}

public struct Donation has key, store {
    id: UID,
    campaign_id: ID,
    donor: address,
    amount: u64,
    timestamp: u64,
}

public entry fun create_campaign(name: vector<u8>, description: vector<u8>, ctx: &mut TxContext) {
    let campaign = Campaign {
        id: object::new(ctx),
        name,
        description,
        admin: tx_context::sender(ctx),
        total_donated: 0,
        funds: coin::zero<IOTA>(ctx),
        active: true,
    };

    transfer::share_object(campaign);
}

public entry fun donate(campaign: &mut Campaign, donation: Coin<IOTA>, ctx: &mut TxContext): ID {
    let amount = coin::value(&donation);
    transfer::public_transfer(donation, campaign.admin);

    campaign.total_donated = campaign.total_donated + amount;

    let donation = Donation {
        id: object::new(ctx),
        campaign_id: campaign.id.to_inner(),
        donor: tx_context::sender(ctx),
        amount,
        timestamp: tx_context::epoch(ctx),
    };

    let id = donation.id.to_inner();
    transfer::transfer(donation, tx_context::sender(ctx));

    id
}

public entry fun withdraw(
    campaign: &mut Campaign,
    amount: u64,
    recipient: address,
    ctx: &mut TxContext,
) {
    assert!(campaign.admin == tx_context::sender(ctx), 1);

    let coin_out = coin::split(&mut campaign.funds, amount, ctx);

    transfer::public_transfer(coin_out, recipient);
}

public entry fun close_campaign(campaign: &mut Campaign, ctx: &mut TxContext) {
    assert!(tx_context::sender(ctx) == campaign.admin, 1);
    campaign.active = false;
}
