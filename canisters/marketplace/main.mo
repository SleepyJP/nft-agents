import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import HashMap "mo:base/HashMap";
import Hash "mo:base/Hash";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";

/// ICP Marketplace — ICRC-7 NFT trading
actor class Marketplace(init : { owner : Principal; nftCanister : Principal; treasury : Principal }) = this {

  public type ListingStatus = { #Active; #Sold; #Cancelled };

  public type Listing = {
    listingId : Nat;
    tokenId : Nat;
    seller : Principal;
    price : Nat64;        // in e8s (ICP)
    status : ListingStatus;
    createdAt : Int;
  };

  stable var _owner : Principal = init.owner;
  stable var _nftCanister : Principal = init.nftCanister;
  stable var _treasury : Principal = init.treasury;
  stable var _nextListingId : Nat = 1;
  stable var _platformFeeBps : Nat = 200; // 2%

  stable var _listingEntries : [(Nat, Listing)] = [];
  stable var _tokenToListing : [(Nat, Nat)] = [];

  var listings = HashMap.HashMap<Nat, Listing>(32, Nat.equal, Hash.hash);
  var tokenToListing = HashMap.HashMap<Nat, Nat>(32, Nat.equal, Hash.hash);

  system func preupgrade() {
    _listingEntries := Iter.toArray(listings.entries());
    _tokenToListing := Iter.toArray(tokenToListing.entries());
  };
  system func postupgrade() {
    listings := HashMap.fromIter(_listingEntries.vals(), _listingEntries.size(), Nat.equal, Hash.hash);
    tokenToListing := HashMap.fromIter(_tokenToListing.vals(), _tokenToListing.size(), Nat.equal, Hash.hash);
    _listingEntries := [];
    _tokenToListing := [];
  };

  /// List an NFT for sale (verifies ownership via NFT canister)
  public shared(msg) func list(tokenId : Nat, price : Nat64) : async Result.Result<Nat, Text> {
    if (Principal.isAnonymous(msg.caller)) { return #err("Anonymous caller not allowed") };
    if (price == 0) { return #err("Price must be greater than zero") };

    // Check not already listed
    switch (tokenToListing.get(tokenId)) {
      case (?_) { return #err("Already listed") };
      case null {};
    };

    // Verify ownership via NFT canister
    let nft : actor {
      icrc7_owner_of : shared query ([Nat]) -> async [?{ owner : Principal; subaccount : ?Blob }];
    } = actor(Principal.toText(_nftCanister));

    let owners = await nft.icrc7_owner_of([tokenId]);
    switch (owners[0]) {
      case (?ownerInfo) {
        if (ownerInfo.owner != msg.caller) {
          return #err("Not the token owner");
        };
      };
      case null { return #err("Token does not exist") };
    };

    let listingId = _nextListingId;
    _nextListingId += 1;

    let listing : Listing = {
      listingId;
      tokenId;
      seller = msg.caller;
      price;
      status = #Active;
      createdAt = Time.now();
    };

    listings.put(listingId, listing);
    tokenToListing.put(tokenId, listingId);

    #ok(listingId);
  };

  /// Cancel a listing
  public shared(msg) func cancel(listingId : Nat) : async Result.Result<(), Text> {
    switch (listings.get(listingId)) {
      case (?listing) {
        if (listing.seller != msg.caller and msg.caller != _owner) {
          return #err("Not authorized");
        };
        listings.put(listingId, { listing with status = #Cancelled });
        tokenToListing.delete(listing.tokenId);
        #ok(());
      };
      case null { #err("Listing not found") };
    };
  };

  /// Get active listings
  public query func getActiveListings(limit : Nat) : async [Listing] {
    let buf = Buffer.Buffer<Listing>(limit);
    var count = 0;
    for ((_, listing) in listings.entries()) {
      if (count >= limit) { return Buffer.toArray(buf) };
      switch (listing.status) {
        case (#Active) { buf.add(listing); count += 1 };
        case _ {};
      };
    };
    Buffer.toArray(buf);
  };

  /// Get listing by ID
  public query func getListing(listingId : Nat) : async ?Listing {
    listings.get(listingId);
  };

  // Admin
  public shared(msg) func setOwner(o : Principal) : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    if (Principal.isAnonymous(o)) { return #err("Cannot set anonymous as owner") };
    _owner := o;
    #ok(());
  };
  public shared(msg) func setTreasury(t : Principal) : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    _treasury := t;
    #ok(());
  };
  public shared(msg) func setPlatformFee(bps : Nat) : async Result.Result<(), Text> {
    if (msg.caller != _owner) { return #err("Not owner") };
    if (bps > 3000) { return #err("Fee cannot exceed 30%") };
    _platformFeeBps := bps;
    #ok(());
  };
};
