import{A as e,C as t,D as n,E as r,N as i,O as a,S as o,T as s,_ as c,a as l,b as u,c as d,d as f,f as p,g as m,h,i as g,j as _,k as ee,l as te,m as ne,n as re,o as ie,r as v,s as ae,t as oe,u as se,v as ce,w as le,x as y,y as ue}from"./index-Bzg9INqq.js";var b=function(e){return e.Failure=`FAILURE`,e.Success=`SUCCESS`,e}({}),x=function(e){return e.PersonalMessage=`PERSONAL_MESSAGE`,e.TransactionData=`TRANSACTION_DATA`,e}({}),S=class extends String{constructor(e,t){super(e),this.value=e,this.__meta__=t}toString(){return this.value}};new S(`
    fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}
    `,{fragmentName:`OBJECT_OWNER_FIELDS`}),new S(`
    fragment OBJECT_FIELDS on Object {
  address
  digest
  version
  objectBcs @include(if: $includeObjectBcs)
  asMoveObject {
    contents {
      bcs @include(if: $includeContent)
      json @include(if: $includeJson)
      display @include(if: $includeDisplay) {
        output
        errors
      }
      type {
        repr
      }
    }
  }
  asMovePackage {
    __typename
  }
  owner {
    ...OBJECT_OWNER_FIELDS
  }
  previousTransaction @include(if: $includePreviousTransaction) {
    digest
  }
}
    fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}`,{fragmentName:`OBJECT_FIELDS`}),new S(`
    fragment MOVE_OBJECT_FIELDS on MoveObject {
  address
  digest
  version
  objectBcs @include(if: $includeObjectBcs)
  contents {
    bcs @include(if: $includeContent)
    json @include(if: $includeJson)
    display @include(if: $includeDisplay) {
      output
      errors
    }
    type {
      repr
    }
  }
  owner {
    ...OBJECT_OWNER_FIELDS
  }
  previousTransaction @include(if: $includePreviousTransaction) {
    digest
  }
}
    fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}`,{fragmentName:`MOVE_OBJECT_FIELDS`}),new S(`
    fragment TRANSACTION_FIELDS on Transaction {
  digest
  transactionJson @include(if: $includeTransaction)
  transactionBcs @include(if: $includeBcs)
  signatures {
    signatureBytes
  }
  effects {
    status
    timestamp
    checkpoint {
      sequenceNumber
    }
    executionError {
      message
      abortCode
      identifier
      constant
      sourceLineNumber
      instructionOffset
      module {
        name
        package {
          address
        }
      }
      function {
        name
      }
    }
    epoch {
      epochId
    }
    effectsBcs @include(if: $includeEffects)
    effectsJson @include(if: $includeObjectTypes)
    objectChanges(first: 50) @include(if: $includeObjectTypes) {
      nodes {
        address
        outputState {
          asMoveObject {
            contents {
              type {
                repr
              }
            }
          }
        }
      }
    }
    balanceChangesJson @include(if: $includeBalanceChanges)
    events(first: 50) @include(if: $includeEvents) {
      pageInfo {
        hasNextPage
      }
      nodes {
        transactionModule {
          package {
            address
          }
          name
        }
        sender {
          address
        }
        contents {
          type {
            repr
          }
          bcs
          json
        }
      }
    }
  }
}
    `,{fragmentName:`TRANSACTION_FIELDS`});var de=new S(`
    query getAllBalances($owner: SuiAddress!, $limit: Int, $cursor: String) {
  address(address: $owner) {
    balances(first: $limit, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        coinType {
          repr
        }
        totalBalance
        addressBalance
      }
    }
  }
}
    `),fe=new S(`
    query getBalance($owner: SuiAddress!, $coinType: String = "0x2::sui::SUI") {
  address(address: $owner) {
    balance(coinType: $coinType) {
      coinType {
        repr
      }
      totalBalance
      addressBalance
    }
  }
}
    `),pe=new S(`
    query getChainIdentifier {
  checkpoint(sequenceNumber: 0) {
    digest
  }
}
    `),me=new S(`
    query getCoinMetadata($coinType: String!) {
  coinMetadata(coinType: $coinType) {
    address
    decimals
    name
    symbol
    description
    iconUrl
  }
}
    `),he=new S(`
    query getCoins($owner: SuiAddress!, $first: Int, $cursor: String, $type: String = "0x2::coin::Coin<0x2::sui::SUI>") {
  address(address: $owner) {
    address
    objects(first: $first, after: $cursor, filter: {type: $type}) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        owner {
          ...OBJECT_OWNER_FIELDS
        }
        contents {
          json
          type {
            repr
          }
        }
        address
        version
        digest
      }
    }
  }
}
    fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}`),ge=new S(`
    query getCurrentSystemState {
  epoch {
    epochId
    referenceGasPrice
    startTimestamp
    protocolConfigs {
      protocolVersion
    }
    systemState {
      json
    }
  }
}
    `),_e=new S(`
    query getDynamicFields($parentId: SuiAddress!, $first: Int, $cursor: String, $includeValue: Boolean = false) {
  address(address: $parentId) {
    dynamicFields(first: $first, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        name {
          bcs
          type {
            repr
          }
        }
        value {
          __typename
          ... on MoveValue {
            bcs @include(if: $includeValue)
            type {
              repr
            }
          }
          ... on MoveObject {
            address
            contents {
              bcs @include(if: $includeValue)
              type {
                repr
              }
            }
          }
        }
      }
    }
  }
}
    `),ve=new S(`
    query getMoveFunction($package: SuiAddress!, $module: String!, $function: String!) {
  package(address: $package) {
    module(name: $module) {
      function(name: $function) {
        name
        visibility
        isEntry
        typeParameters {
          constraints
        }
        parameters {
          signature
        }
        return {
          signature
        }
      }
    }
  }
}
    `),ye=new S(`
    query getProtocolConfig {
  epoch {
    protocolConfigs {
      protocolVersion
      featureFlags {
        key
        value
      }
      configs {
        key
        value
      }
    }
  }
}
    `),be=new S(`
    query getReferenceGasPrice {
  epoch {
    referenceGasPrice
  }
}
    `),C=new S(`
    query listEvents($filter: EventFilter, $first: Int, $after: String, $last: Int, $before: String) {
  events(
    filter: $filter
    first: $first
    after: $after
    last: $last
    before: $before
  ) {
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    nodes {
      sequenceNumber
      transaction {
        digest
        effects {
          checkpoint {
            sequenceNumber
          }
        }
      }
      transactionModule {
        package {
          address
        }
        name
      }
      sender {
        address
      }
      contents {
        type {
          repr
        }
        bcs
        json
      }
    }
  }
}
    `),w=new S(`
    query defaultSuinsName($address: SuiAddress!) {
  address(address: $address) {
    defaultNameRecord {
      domain
    }
  }
}
    `),T=new S(`
    query resolveNameServiceAddress($name: String!) {
  address(name: $name) {
    address
  }
}
    `),E=new S(`
    query getOwnedObjects($owner: SuiAddress!, $limit: Int, $cursor: String, $filter: ObjectFilter, $includeContent: Boolean = false, $includePreviousTransaction: Boolean = false, $includeObjectBcs: Boolean = false, $includeJson: Boolean = false, $includeDisplay: Boolean = false) {
  address(address: $owner) {
    objects(first: $limit, after: $cursor, filter: $filter) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...MOVE_OBJECT_FIELDS
      }
    }
  }
}
    fragment MOVE_OBJECT_FIELDS on MoveObject {
  address
  digest
  version
  objectBcs @include(if: $includeObjectBcs)
  contents {
    bcs @include(if: $includeContent)
    json @include(if: $includeJson)
    display @include(if: $includeDisplay) {
      output
      errors
    }
    type {
      repr
    }
  }
  owner {
    ...OBJECT_OWNER_FIELDS
  }
  previousTransaction @include(if: $includePreviousTransaction) {
    digest
  }
}
fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}`),D=new S(`
    query multiGetObjects($objectKeys: [ObjectKey!]!, $includeContent: Boolean = false, $includePreviousTransaction: Boolean = false, $includeObjectBcs: Boolean = false, $includeJson: Boolean = false, $includeDisplay: Boolean = false) {
  multiGetObjects(keys: $objectKeys) {
    ...OBJECT_FIELDS
  }
}
    fragment OBJECT_FIELDS on Object {
  address
  digest
  version
  objectBcs @include(if: $includeObjectBcs)
  asMoveObject {
    contents {
      bcs @include(if: $includeContent)
      json @include(if: $includeJson)
      display @include(if: $includeDisplay) {
        output
        errors
      }
      type {
        repr
      }
    }
  }
  asMovePackage {
    __typename
  }
  owner {
    ...OBJECT_OWNER_FIELDS
  }
  previousTransaction @include(if: $includePreviousTransaction) {
    digest
  }
}
fragment OBJECT_OWNER_FIELDS on Owner {
  __typename
  ... on AddressOwner {
    address {
      address
    }
  }
  ... on ObjectOwner {
    address {
      address
    }
  }
  ... on Shared {
    initialSharedVersion
  }
  ... on ConsensusAddressOwner {
    startVersion
    address {
      address
    }
  }
}`),O=new S(`
    query simulateTransaction($transaction: JSON!, $includeTransaction: Boolean = false, $includeEffects: Boolean = false, $includeEvents: Boolean = false, $includeBalanceChanges: Boolean = false, $includeObjectTypes: Boolean = false, $includeCommandResults: Boolean = false, $includeBcs: Boolean = false, $doGasSelection: Boolean = false, $checksEnabled: Boolean = true) {
  simulateTransaction(
    transaction: $transaction
    doGasSelection: $doGasSelection
    checksEnabled: $checksEnabled
  ) {
    effects {
      transaction {
        ...TRANSACTION_FIELDS
        effects {
          gasEffects {
            gasObject {
              address
            }
          }
        }
      }
    }
    outputs @include(if: $includeCommandResults) {
      returnValues {
        value {
          bcs
        }
      }
      mutatedReferences {
        value {
          bcs
        }
      }
    }
  }
}
    fragment TRANSACTION_FIELDS on Transaction {
  digest
  transactionJson @include(if: $includeTransaction)
  transactionBcs @include(if: $includeBcs)
  signatures {
    signatureBytes
  }
  effects {
    status
    timestamp
    checkpoint {
      sequenceNumber
    }
    executionError {
      message
      abortCode
      identifier
      constant
      sourceLineNumber
      instructionOffset
      module {
        name
        package {
          address
        }
      }
      function {
        name
      }
    }
    epoch {
      epochId
    }
    effectsBcs @include(if: $includeEffects)
    effectsJson @include(if: $includeObjectTypes)
    objectChanges(first: 50) @include(if: $includeObjectTypes) {
      nodes {
        address
        outputState {
          asMoveObject {
            contents {
              type {
                repr
              }
            }
          }
        }
      }
    }
    balanceChangesJson @include(if: $includeBalanceChanges)
    events(first: 50) @include(if: $includeEvents) {
      pageInfo {
        hasNextPage
      }
      nodes {
        transactionModule {
          package {
            address
          }
          name
        }
        sender {
          address
        }
        contents {
          type {
            repr
          }
          bcs
          json
        }
      }
    }
  }
}`),k=new S(`
    mutation executeTransaction($transactionDataBcs: Base64!, $signatures: [Base64!]!, $includeTransaction: Boolean = false, $includeEffects: Boolean = false, $includeEvents: Boolean = false, $includeBalanceChanges: Boolean = false, $includeObjectTypes: Boolean = false, $includeBcs: Boolean = false) {
  executeTransaction(
    transactionDataBcs: $transactionDataBcs
    signatures: $signatures
  ) {
    effects {
      transaction {
        ...TRANSACTION_FIELDS
      }
    }
  }
}
    fragment TRANSACTION_FIELDS on Transaction {
  digest
  transactionJson @include(if: $includeTransaction)
  transactionBcs @include(if: $includeBcs)
  signatures {
    signatureBytes
  }
  effects {
    status
    timestamp
    checkpoint {
      sequenceNumber
    }
    executionError {
      message
      abortCode
      identifier
      constant
      sourceLineNumber
      instructionOffset
      module {
        name
        package {
          address
        }
      }
      function {
        name
      }
    }
    epoch {
      epochId
    }
    effectsBcs @include(if: $includeEffects)
    effectsJson @include(if: $includeObjectTypes)
    objectChanges(first: 50) @include(if: $includeObjectTypes) {
      nodes {
        address
        outputState {
          asMoveObject {
            contents {
              type {
                repr
              }
            }
          }
        }
      }
    }
    balanceChangesJson @include(if: $includeBalanceChanges)
    events(first: 50) @include(if: $includeEvents) {
      pageInfo {
        hasNextPage
      }
      nodes {
        transactionModule {
          package {
            address
          }
          name
        }
        sender {
          address
        }
        contents {
          type {
            repr
          }
          bcs
          json
        }
      }
    }
  }
}`),A=new S(`
    query getTransactionBlock($digest: String!, $includeTransaction: Boolean = false, $includeEffects: Boolean = false, $includeEvents: Boolean = false, $includeBalanceChanges: Boolean = false, $includeObjectTypes: Boolean = false, $includeBcs: Boolean = false) {
  transaction(digest: $digest) {
    ...TRANSACTION_FIELDS
  }
}
    fragment TRANSACTION_FIELDS on Transaction {
  digest
  transactionJson @include(if: $includeTransaction)
  transactionBcs @include(if: $includeBcs)
  signatures {
    signatureBytes
  }
  effects {
    status
    timestamp
    checkpoint {
      sequenceNumber
    }
    executionError {
      message
      abortCode
      identifier
      constant
      sourceLineNumber
      instructionOffset
      module {
        name
        package {
          address
        }
      }
      function {
        name
      }
    }
    epoch {
      epochId
    }
    effectsBcs @include(if: $includeEffects)
    effectsJson @include(if: $includeObjectTypes)
    objectChanges(first: 50) @include(if: $includeObjectTypes) {
      nodes {
        address
        outputState {
          asMoveObject {
            contents {
              type {
                repr
              }
            }
          }
        }
      }
    }
    balanceChangesJson @include(if: $includeBalanceChanges)
    events(first: 50) @include(if: $includeEvents) {
      pageInfo {
        hasNextPage
      }
      nodes {
        transactionModule {
          package {
            address
          }
          name
        }
        sender {
          address
        }
        contents {
          type {
            repr
          }
          bcs
          json
        }
      }
    }
  }
}`),j=new S(`
    query listTransactions($filter: TransactionFilter, $first: Int, $after: String, $last: Int, $before: String, $includeTransaction: Boolean = false, $includeEffects: Boolean = false, $includeEvents: Boolean = false, $includeBalanceChanges: Boolean = false, $includeObjectTypes: Boolean = false, $includeBcs: Boolean = false) {
  transactions(
    filter: $filter
    first: $first
    after: $after
    last: $last
    before: $before
  ) {
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    nodes {
      ...TRANSACTION_FIELDS
    }
  }
}
    fragment TRANSACTION_FIELDS on Transaction {
  digest
  transactionJson @include(if: $includeTransaction)
  transactionBcs @include(if: $includeBcs)
  signatures {
    signatureBytes
  }
  effects {
    status
    timestamp
    checkpoint {
      sequenceNumber
    }
    executionError {
      message
      abortCode
      identifier
      constant
      sourceLineNumber
      instructionOffset
      module {
        name
        package {
          address
        }
      }
      function {
        name
      }
    }
    epoch {
      epochId
    }
    effectsBcs @include(if: $includeEffects)
    effectsJson @include(if: $includeObjectTypes)
    objectChanges(first: 50) @include(if: $includeObjectTypes) {
      nodes {
        address
        outputState {
          asMoveObject {
            contents {
              type {
                repr
              }
            }
          }
        }
      }
    }
    balanceChangesJson @include(if: $includeBalanceChanges)
    events(first: 50) @include(if: $includeEvents) {
      pageInfo {
        hasNextPage
      }
      nodes {
        transactionModule {
          package {
            address
          }
          name
        }
        sender {
          address
        }
        contents {
          type {
            repr
          }
          bcs
          json
        }
      }
    }
  }
}`),M=new S(`
    query resolveTransaction($transaction: JSON!, $doGasSelection: Boolean = true, $checksEnabled: Boolean = true) {
  simulateTransaction(
    transaction: $transaction
    doGasSelection: $doGasSelection
    checksEnabled: $checksEnabled
  ) {
    effects {
      transaction {
        transactionBcs
        effects {
          epoch {
            epochId
          }
          status
          executionError {
            message
            abortCode
            identifier
            constant
            sourceLineNumber
            instructionOffset
            module {
              name
              package {
                address
              }
            }
            function {
              name
            }
          }
        }
      }
    }
  }
}
    `),N=new S(`
    query verifyZkLoginSignature($bytes: Base64!, $signature: Base64!, $intentScope: ZkLoginIntentScope!, $author: SuiAddress!) {
  verifyZkLoginSignature(
    bytes: $bytes
    signature: $signature
    intentScope: $intentScope
    author: $author
  ) {
    success
  }
}
    `),xe=40,Se=class extends ce{#e;constructor({graphqlClient:e,mvr:t}){super({network:e.network,base:e,mvr:t}),this.#e=e}async#t(e,t,n){let{data:r,errors:i}=await this.#e.query(e);F(i);let a=r&&(t?t(r):r);if(a==null)throw n?.()??Error(`Missing response data`);return a}async getObjects(t){let n=ee(t.objectIds,xe),r=[];for(let i of n){let n=await this.#t({query:D,signal:t.signal,variables:{objectKeys:i.map(e=>({address:e})),includeContent:t.include?.content??!1,includePreviousTransaction:t.include?.previousTransaction??!1,includeObjectBcs:t.include?.objectBcs??!1,includeJson:t.include?.json??!1,includeDisplay:t.include?.display??!1}},e=>e.multiGetObjects);r.push(...i.map(e=>({objectId:e,normalized:a(e)})).map(({objectId:e,normalized:t})=>n.find(e=>e?.address===t)??new y(`notFound`,`Object ${t} not found`,{reason:`notFound`,objectId:e})).map(n=>{if(n instanceof y)return n;let r=n.asMoveObject?.contents?.bcs?e(n.asMoveObject.contents.bcs):void 0,i=n.objectBcs?e(n.objectBcs):void 0,a;a=n.asMovePackage?`package`:n.asMoveObject?.contents?.type?.repr?n.asMoveObject.contents.type.repr:``;let o=t.include?.json?n.asMoveObject?.contents?.json?n.asMoveObject.contents.json:null:void 0,s=P(t.include?.display,n.asMoveObject?.contents?.display);return{objectId:n.address,version:n.version?.toString(),digest:n.digest,owner:I(n.owner),type:a,content:r,previousTransaction:n.previousTransaction?.digest??void 0,objectBcs:i,json:o,display:s}}))}return{objects:r}}async listOwnedObjects(t){let n=await this.#t({query:E,signal:t.signal,variables:{owner:t.owner,limit:t.limit,cursor:t.cursor,filter:t.type?{type:(await this.mvr.resolveType({type:t.type,signal:t.signal})).type}:void 0,includeContent:t.include?.content??!1,includePreviousTransaction:t.include?.previousTransaction??!1,includeObjectBcs:t.include?.objectBcs??!1,includeJson:t.include?.json??!1,includeDisplay:t.include?.display??!1}},e=>e.address?.objects);return{objects:n.nodes.map(n=>({objectId:n.address,version:n.version?.toString(),digest:n.digest,owner:I(n.owner),type:n.contents?.type?.repr,content:n.contents?.bcs?e(n.contents.bcs):void 0,previousTransaction:n.previousTransaction?.digest??void 0,objectBcs:n.objectBcs?e(n.objectBcs):void 0,json:t.include?.json?n.contents?.json?n.contents.json:null:void 0,display:P(t.include?.display,n.contents?.display)})),hasNextPage:n.pageInfo.hasNextPage,cursor:n.pageInfo.endCursor??null}}async listCoins(e){let t=e.coinType??s,n=await this.#t({query:he,signal:e.signal,variables:{owner:e.owner,cursor:e.cursor,first:e.limit,type:`0x2::coin::Coin<${(await this.mvr.resolveType({type:t,signal:e.signal})).type}>`}},e=>e.address?.objects);return{cursor:n.pageInfo.endCursor??null,hasNextPage:n.pageInfo.hasNextPage,objects:n.nodes.map(e=>({objectId:e.address,version:e.version?.toString(),digest:e.digest,owner:I(e.owner),type:e.contents?.type?.repr,balance:e.contents?.json?.balance}))}}async getBalance(e){let t=e.coinType??s,n=await this.#t({query:fe,signal:e.signal,variables:{owner:e.owner,coinType:(await this.mvr.resolveType({type:t,signal:e.signal})).type}},e=>e.address?.balance),r=BigInt(n.addressBalance??`0`),i=BigInt(n.totalBalance??`0`)-r;return{balance:{coinType:n.coinType?.repr??t,balance:n.totalBalance??`0`,coinBalance:i.toString(),addressBalance:r.toString()}}}async getCoinMetadata(e){let t=(await this.mvr.resolveType({type:e.coinType,signal:e.signal})).type,{data:n,errors:r}=await this.#e.query({query:me,signal:e.signal,variables:{coinType:t}});return F(r),n?.coinMetadata?{coinMetadata:{id:n.coinMetadata.address,decimals:n.coinMetadata.decimals,name:n.coinMetadata.name,symbol:n.coinMetadata.symbol,description:n.coinMetadata.description,iconUrl:n.coinMetadata.iconUrl??null}}:{coinMetadata:null}}async listBalances(e){let t=await this.#t({query:de,signal:e.signal,variables:{owner:e.owner,limit:e.limit,cursor:e.cursor}},e=>e.address?.balances);return{cursor:t.pageInfo.endCursor??null,hasNextPage:t.pageInfo.hasNextPage,balances:t.nodes.map(e=>{let t=BigInt(e.addressBalance??`0`),n=BigInt(e.totalBalance??`0`)-t;return{coinType:e.coinType?.repr,balance:e.totalBalance,coinBalance:n.toString(),addressBalance:t.toString()}})}}async getTransaction(e){return L(await this.#t({query:A,signal:e.signal,variables:{digest:e.digest,includeTransaction:e.include?.transaction??!1,includeEffects:e.include?.effects??!1,includeEvents:e.include?.events??!1,includeBalanceChanges:e.include?.balanceChanges??!1,includeObjectTypes:e.include?.objectTypes??!1,includeBcs:e.include?.bcs??!1}},e=>e.transaction,()=>new t(`notFound`,e.digest)),e.include)}async executeTransaction(e){return L((await this.#t({query:k,signal:e.signal,variables:{transactionDataBcs:_(e.transaction),signatures:e.signatures,includeTransaction:e.include?.transaction??!1,includeEffects:e.include?.effects??!1,includeEvents:e.include?.events??!1,includeBalanceChanges:e.include?.balanceChanges??!1,includeObjectTypes:e.include?.objectTypes??!1,includeBcs:e.include?.bcs??!1}},e=>e.executeTransaction)).effects?.transaction,e.include)}async simulateTransaction(t){t.transaction instanceof Uint8Array||await t.transaction.prepareForSerialization({client:this});let n=t.doGasSelection??(t.transaction instanceof Uint8Array?c(t.transaction):t.transaction.getData().gasData.payment?.length===0),r=await this.#t({query:O,signal:t.signal,variables:{transaction:t.transaction instanceof Uint8Array?{bcs:{value:_(t.transaction)}}:se(t.transaction),includeTransaction:t.include?.transaction??!1,includeEffects:t.include?.effects??!1,includeEvents:t.include?.events??!1,includeBalanceChanges:t.include?.balanceChanges??!1,includeObjectTypes:t.include?.objectTypes??!1,includeCommandResults:t.include?.commandResults??!1,includeBcs:t.include?.bcs??!1,doGasSelection:n,checksEnabled:t.checksEnabled??!0}},e=>e.simulateTransaction),i=L(r.effects?.transaction,t.include),a=h(r.effects?.transaction?.effects?.gasEffects?.gasObject?.address),o=t.include?.commandResults&&r.outputs?r.outputs.map(t=>({returnValues:(t.returnValues??[]).map(t=>({bcs:t.value?.bcs?e(t.value.bcs):null})),mutatedReferences:(t.mutatedReferences??[]).map(t=>({bcs:t.value?.bcs?e(t.value.bcs):null}))})):void 0;return i.$kind===`Transaction`?{$kind:`Transaction`,Transaction:i.Transaction,commandResults:o,gasPaymentMocked:a}:{$kind:`FailedTransaction`,FailedTransaction:i.FailedTransaction,commandResults:o,gasPaymentMocked:a}}async getReferenceGasPrice(e){return{referenceGasPrice:await this.#t({query:be,signal:e?.signal},e=>e.epoch?.referenceGasPrice)??``}}async getProtocolConfig(e){let t=await this.#t({query:ye,signal:e?.signal},e=>e.epoch?.protocolConfigs),n={};for(let e of t?.featureFlags??[])n[e.key]=e.value;let r={};for(let e of t?.configs??[])r[e.key]=e.value??null;return{protocolConfig:{protocolVersion:t?.protocolVersion?.toString()??null,featureFlags:n,attributes:r}}}async getCurrentSystemState(e){let t=await this.#t({query:ge,signal:e?.signal},e=>e.epoch);if(!t)throw Error(`Epoch data not found in response`);let n=t.startTimestamp?new Date(t.startTimestamp).getTime().toString():null,r=t.systemState?.json;return{systemState:{systemStateVersion:r?.system_state_version?.toString()??null,epoch:t.epochId?.toString()??null,protocolVersion:t.protocolConfigs?.protocolVersion?.toString()??null,referenceGasPrice:t.referenceGasPrice??null,epochStartTimestampMs:n,safeMode:r?.safe_mode??!1,safeModeStorageRewards:r?.safe_mode_storage_rewards??null,safeModeComputationRewards:r?.safe_mode_computation_rewards??null,safeModeStorageRebates:r?.safe_mode_storage_rebates?.toString()??null,safeModeNonRefundableStorageFee:r?.safe_mode_non_refundable_storage_fee?.toString()??null,parameters:{epochDurationMs:r?.parameters?.epoch_duration_ms?.toString()??null,stakeSubsidyStartEpoch:r?.parameters?.stake_subsidy_start_epoch?.toString()??null,maxValidatorCount:r?.parameters?.max_validator_count?.toString()??null,minValidatorJoiningStake:r?.parameters?.min_validator_joining_stake?.toString()??null,validatorLowStakeThreshold:r?.parameters?.validator_low_stake_threshold?.toString()??null,validatorLowStakeGracePeriod:r?.parameters?.validator_low_stake_grace_period?.toString()??null},storageFund:{totalObjectStorageRebates:r?.storage_fund?.total_object_storage_rebates??null,nonRefundableBalance:r?.storage_fund?.non_refundable_balance??null},stakeSubsidy:{balance:r?.stake_subsidy?.balance??null,distributionCounter:r?.stake_subsidy?.distribution_counter?.toString()??null,currentDistributionAmount:r?.stake_subsidy?.current_distribution_amount?.toString()??null,stakeSubsidyPeriodLength:r?.stake_subsidy?.stake_subsidy_period_length?.toString()??null,stakeSubsidyDecreaseRate:r?.stake_subsidy?.stake_subsidy_decrease_rate??null}}}}async listDynamicFields(e){return this.#e.listDynamicFields(e)}async listTransactions(e){let t=v(e),{descending:n,after:r,before:i,limit:a}=t,o=e.filter?await g(this.mvr,e.filter,e.signal):void 0;l(o,t);let s=await this.#t({query:j,signal:e.signal,variables:{filter:o&&{sentAddress:o.$kind===`sender`?o.sender:void 0,function:o.$kind===`function`?[o.package,o.module,o.function].filter(Boolean).join(`::`):void 0},first:n?void 0:a,after:r,last:n?a:void 0,before:i,includeTransaction:e.include?.transaction??!1,includeEffects:e.include?.effects??!1,includeEvents:e.include?.events??!1,includeBalanceChanges:e.include?.balanceChanges??!1,includeObjectTypes:e.include?.objectTypes??!1,includeBcs:e.include?.bcs??!1}},e=>e.transactions);return{transactions:(n?[...s.nodes].reverse():s.nodes).map(t=>L(t,e.include)),hasNextPage:n?s.pageInfo.hasPreviousPage:s.pageInfo.hasNextPage,startCursor:(n?s.pageInfo.endCursor:s.pageInfo.startCursor)??null,endCursor:(n?s.pageInfo.startCursor:s.pageInfo.endCursor)??null}}async listEvents(t){let{descending:r,after:i,before:o,limit:s}=v(t),c=t.filter?await re(this.mvr,t.filter,t.signal):void 0,l=await this.#t({query:C,signal:t.signal,variables:{filter:c&&{sender:c.$kind===`sender`?c.sender:void 0,module:c.$kind===`emitModule`?`${c.package}::${c.module}`:void 0,type:c.$kind===`eventTypeModule`?`${c.package}::${c.module}`:c.$kind===`eventType`?c.eventType:void 0},first:r?void 0:s,after:i,last:r?s:void 0,before:o}},e=>e.events);return{events:(r?[...l.nodes].reverse():l.nodes).map(t=>{let r=t.transactionModule?.package?.address,i=t.transactionModule?.name,o=t.sender?.address,s=t.contents?.type?.repr,c=t.transaction?.digest;if(!r||!i||!o||!s||!c)throw Error(`listEvents response is missing expected event fields`);return{packageId:a(r),module:i,sender:a(o),eventType:n(s),bcs:t.contents?.bcs?e(t.contents.bcs):new Uint8Array,json:t.contents?.json??null,checkpoint:t.transaction?.effects?.checkpoint?.sequenceNumber?.toString()??null,transactionDigest:c,eventIndex:t.sequenceNumber}}),hasNextPage:r?l.pageInfo.hasPreviousPage:l.pageInfo.hasNextPage,startCursor:(r?l.pageInfo.endCursor:l.pageInfo.startCursor)??null,endCursor:(r?l.pageInfo.startCursor:l.pageInfo.endCursor)??null}}async verifyZkLoginSignature(e){let t=e.intentScope===`TransactionData`?x.TransactionData:x.PersonalMessage,{data:n}=await this.#e.query({query:N,signal:e.signal,variables:{bytes:e.bytes,signature:e.signature,intentScope:t,author:e.address}});return{success:n?.verifyZkLoginSignature?.success??!1,errors:[]}}async defaultNameServiceName(e){let{data:t,errors:n}=await this.#e.query({query:w,signal:e.signal,variables:{address:e.address}});return F(n),{data:{name:t?.address?.defaultNameRecord?.domain??null}}}async resolveNameServiceAddress(e){let{data:t,errors:n}=await this.#e.query({query:T,signal:e.signal,variables:{name:e.name}});return F(n),{address:t?.address?.address??null}}async getMoveFunction(e){let t=await this.#t({query:ve,signal:e.signal,variables:{package:(await this.mvr.resolvePackage({package:e.packageId,signal:e.signal})).package,module:e.moduleName,function:e.name}},e=>e.package?.module?.function),n=`unknown`;switch(t.visibility){case`PUBLIC`:n=`public`;break;case`PRIVATE`:n=`private`;break;case`FRIEND`:n=`friend`;break}return{function:{packageId:a(e.packageId),moduleName:e.moduleName,name:t.name,visibility:n,isEntry:t.isEntry??!1,typeParameters:t.typeParameters?.map(({constraints:e})=>({isPhantom:!1,constraints:e.map(e=>{switch(e){case`COPY`:return`copy`;case`DROP`:return`drop`;case`STORE`:return`store`;case`KEY`:return`key`;default:return`unknown`}})??[]}))??[],parameters:t.parameters?.map(e=>R(e.signature))??[],returns:t.return?.map(({signature:e})=>R(e))??[]}}}async getChainIdentifier(e){let t=this.cache.read([`chainIdentifier`],async()=>{let e=await this.#t({query:pe},e=>e.checkpoint);if(!e?.digest)throw Error(`Genesis checkpoint digest not found`);return{chainIdentifier:e.digest}});return le(Promise.resolve(t),e?.signal)}resolveTransactionPlugin(){let t=this.#e;return async function(n,i,a){let s=n.snapshot();s.sender||=`0x0000000000000000000000000000000000000000000000000000000000000000`;let c=te(s),l=f.toJson(c),u=!i.onlyTransactionKind&&(s.gasData.budget==null||s.gasData.payment==null),{data:d,errors:p}=await t.query({query:M,variables:{transaction:l,doGasSelection:u,checksEnabled:!i.onlyTransactionKind}});F(p);let m=d?.simulateTransaction?.effects?.transaction?.effects;if(!i.onlyTransactionKind&&m?.status===b.Failure){let e=z(m.executionError);throw new o(`Transaction resolution failed: ${e?.message??`Transaction failed`}`,{executionError:e})}let h=d?.simulateTransaction?.effects?.transaction?.transactionBcs;if(!h)throw Error(`simulateTransaction did not return resolved transaction data`);let g=r.fromBytes(e(h)).snapshot();return i.onlyTransactionKind?n.applyResolvedData({...g,sender:null,gasData:{budget:null,owner:null,payment:null,price:null},expiration:null}):n.applyResolvedData(g),await ae({transactionData:n,client:t,epoch:m?.epoch?.epochId,originalTransactionData:s,isTransactionKindOnly:!!i.onlyTransactionKind,doGasSelection:u}),await a()}}};function P(e,t){if(e)return t?{output:t.output??null,errors:t.errors??null}:null}function F(e){if(!e||e.length===0)return;let t=e.map(e=>new Ce(e));throw t.length===1?t[0]:AggregateError(t)}var Ce=class extends Error{constructor(e){super(e.message),this.locations=e.locations}};function I(e){switch(e.__typename){case`AddressOwner`:return{$kind:`AddressOwner`,AddressOwner:e.address?.address};case`ConsensusAddressOwner`:return{$kind:`ConsensusAddressOwner`,ConsensusAddressOwner:{owner:e?.address?.address,startVersion:String(e.startVersion)}};case`ObjectOwner`:return{$kind:`ObjectOwner`,ObjectOwner:e.address?.address};case`Immutable`:return{$kind:`Immutable`,Immutable:!0};case`Shared`:return{$kind:`Shared`,Shared:{initialSharedVersion:String(e.initialSharedVersion)}}}}function L(t,n){let r={};if(n?.objectTypes){let e=t.effects?.effectsJson;e&&ie.fromJson(e).changedObjects?.forEach(e=>{e.objectId&&e.objectType&&(r[e.objectId]=e.objectType)});let n=t.effects?.objectChanges?.nodes;if(n)for(let e of n){let t=e.outputState?.asMoveObject?.contents?.type?.repr;e.address&&t&&(r[e.address]=t)}}let i;if(n?.balanceChanges){let e=t.effects?.balanceChangesJson;i=Array.isArray(e)?e.map(e=>{let t=oe.fromJson(e);return{coinType:t.coinType,address:t.address,amount:t.amount}}):[]}let a=t.effects?.status===b.Success?{success:!0,error:null}:{success:!1,error:z(t.effects?.executionError)},o;if(n?.transaction&&t.transactionJson){let e=d(f.fromJson(t.transactionJson));o={gasData:e.gasData,sender:e.sender,expiration:e.expiration,commands:e.commands,inputs:e.inputs,version:e.version}}let s=n?.bcs&&t.transactionBcs?e(t.transactionBcs):void 0,c=t.effects?.timestamp?Date.parse(t.effects.timestamp):null,l={digest:t.digest,status:a,effects:n?.effects?m(e(t.effects?.effectsBcs)):void 0,epoch:t.effects?.epoch?.epochId?.toString()??null,timestampMs:c!==null&&!Number.isNaN(c)?c:null,checkpoint:t.effects?.checkpoint?.sequenceNumber?.toString()??null,objectTypes:n?.objectTypes?r:void 0,transaction:o,bcs:s,signatures:t.signatures.map(e=>e.signatureBytes),balanceChanges:i,events:n?.events?t.effects?.events?.nodes.map(t=>{let n=t.contents?.type?.repr,[r,i]=n.split(`::`);return{packageId:r,module:i,sender:t.sender?.address,eventType:n,bcs:t.contents?.bcs?e(t.contents.bcs):new Uint8Array,json:t.contents?.json??null}})??[]:void 0};return a.success?{$kind:`Transaction`,Transaction:l,FailedTransaction:void 0}:{$kind:`FailedTransaction`,Transaction:void 0,FailedTransaction:l}}function R(e){let t=null;return e.ref===`&`?t=`immutable`:e.ref===`&mut`&&(t=`mutable`),{reference:t,body:B(e.body)}}function z(e){if(we(e)===`MoveAbort`&&e?.abortCode!=null){let t=Te(e),n=Ee(e),r=e.message?.match(/in (\d+)\w* command/),i=r?parseInt(r[1],10)-1:void 0;return{$kind:`MoveAbort`,message:ne({command:i,location:t?{package:t.package,module:t.module,functionName:t.functionName,instruction:t.instruction}:void 0,abortCode:e.abortCode,cleverError:n?{lineNumber:n.lineNumber,constantName:n.constantName,value:n.value}:void 0}),command:i,MoveAbort:{abortCode:e.abortCode,location:t,cleverError:n}}}return{$kind:`Unknown`,message:e?.message??`Transaction failed`,Unknown:null}}function we(e){return e?.abortCode==null?e?.message?.match(/^(\w+)/)?.[1]??`Unknown`:`MoveAbort`}function Te(e){if(e.module?.package?.address&&e.module?.name)return{package:e.module?.package?.address,module:e.module?.name,functionName:e.function?.name,instruction:e.instructionOffset??void 0}}function Ee(e){if(e.identifier||e.constant)return{constantName:e.identifier??void 0,value:e.constant??void 0,lineNumber:e.sourceLineNumber??void 0}}function B(e){switch(e){case`address`:return{$kind:`address`};case`bool`:return{$kind:`bool`};case`u8`:return{$kind:`u8`};case`u16`:return{$kind:`u16`};case`u32`:return{$kind:`u32`};case`u64`:return{$kind:`u64`};case`u128`:return{$kind:`u128`};case`u256`:return{$kind:`u256`}}if(typeof e==`string`)throw Error(`Unknown type: ${e}`);if(`vector`in e)return{$kind:`vector`,vector:B(e.vector)};if(`datatype`in e)return{$kind:`datatype`,datatype:{typeName:`${a(e.datatype.package)}::${e.datatype.module}::${e.datatype.type}`,typeParameters:e.datatype.typeParameters.map(e=>B(e))}};if(`typeParameter`in e)return{$kind:`typeParameter`,index:e.typeParameter};throw Error(`Unknown type: ${JSON.stringify(e)}`)}var De=10,V=2;function Oe(e){return H(e,[])}function H(e,t){switch(typeof e){case`string`:return JSON.stringify(e);case`function`:return e.name?`[function ${e.name}]`:`[function]`;case`object`:return ke(e,t);default:return String(e)}}function ke(e,t){if(e===null)return`null`;if(t.includes(e))return`[Circular]`;let n=[...t,e];if(Ae(e)){let t=e.toJSON();if(t!==e)return typeof t==`string`?t:H(t,n)}else if(Array.isArray(e))return Me(e,n);return je(e,n)}function Ae(e){return typeof e.toJSON==`function`}function je(e,t){let n=Object.entries(e);return n.length===0?`{}`:t.length>V?`[`+Ne(e)+`]`:`{ `+n.map(([e,n])=>e+`: `+H(n,t)).join(`, `)+` }`}function Me(e,t){if(e.length===0)return`[]`;if(t.length>V)return`[Array]`;let n=Math.min(De,e.length),r=e.length-n,i=[];for(let r=0;r<n;++r)i.push(H(e[r],t));return r===1?i.push(`... 1 more item`):r>1&&i.push(`... ${r} more items`),`[`+i.join(`, `)+`]`}function Ne(e){let t=Object.prototype.toString.call(e).replace(/^\[object /,``).replace(/]$/,``);if(t===`Object`&&typeof e.constructor==`function`){let t=e.constructor.name;if(typeof t==`string`&&t!==``)return t}return t}var U={Name:[],Document:[`definitions`],OperationDefinition:[`description`,`name`,`variableDefinitions`,`directives`,`selectionSet`],VariableDefinition:[`description`,`variable`,`type`,`defaultValue`,`directives`],Variable:[`name`],SelectionSet:[`selections`],Field:[`alias`,`name`,`arguments`,`directives`,`selectionSet`],Argument:[`name`,`value`],FragmentArgument:[`name`,`value`],FragmentSpread:[`name`,`arguments`,`directives`],InlineFragment:[`typeCondition`,`directives`,`selectionSet`],FragmentDefinition:[`description`,`name`,`variableDefinitions`,`typeCondition`,`directives`,`selectionSet`],IntValue:[],FloatValue:[],StringValue:[],BooleanValue:[],NullValue:[],EnumValue:[],ListValue:[`values`],ObjectValue:[`fields`],ObjectField:[`name`,`value`],Directive:[`name`,`arguments`],NamedType:[`name`],ListType:[`type`],NonNullType:[`type`],SchemaDefinition:[`description`,`directives`,`operationTypes`],OperationTypeDefinition:[`type`],ScalarTypeDefinition:[`description`,`name`,`directives`],ObjectTypeDefinition:[`description`,`name`,`interfaces`,`directives`,`fields`],FieldDefinition:[`description`,`name`,`arguments`,`type`,`directives`],InputValueDefinition:[`description`,`name`,`type`,`defaultValue`,`directives`],InterfaceTypeDefinition:[`description`,`name`,`interfaces`,`directives`,`fields`],UnionTypeDefinition:[`description`,`name`,`directives`,`types`],EnumTypeDefinition:[`description`,`name`,`directives`,`values`],EnumValueDefinition:[`description`,`name`,`directives`],InputObjectTypeDefinition:[`description`,`name`,`directives`,`fields`],DirectiveDefinition:[`description`,`name`,`arguments`,`directives`,`locations`],SchemaExtension:[`directives`,`operationTypes`],DirectiveExtension:[`name`,`directives`],ScalarTypeExtension:[`name`,`directives`],ObjectTypeExtension:[`name`,`interfaces`,`directives`,`fields`],InterfaceTypeExtension:[`name`,`interfaces`,`directives`,`fields`],UnionTypeExtension:[`name`,`directives`,`types`],EnumTypeExtension:[`name`,`directives`,`values`],InputObjectTypeExtension:[`name`,`directives`,`fields`],TypeCoordinate:[`name`],MemberCoordinate:[`name`,`memberName`],ArgumentCoordinate:[`name`,`fieldName`,`argumentName`],DirectiveCoordinate:[`name`],DirectiveArgumentCoordinate:[`name`,`argumentName`]},Pe=new Set(Object.keys(U));function W(e){let t=e?.kind;return typeof t==`string`&&Pe.has(t)}var Fe=i({ARGUMENT:()=>He,ARGUMENT_COORDINATE:()=>kt,BOOLEAN:()=>Ze,DIRECTIVE:()=>rt,DIRECTIVE_ARGUMENT_COORDINATE:()=>jt,DIRECTIVE_COORDINATE:()=>At,DIRECTIVE_DEFINITION:()=>vt,DIRECTIVE_EXTENSION:()=>bt,DOCUMENT:()=>Le,ENUM:()=>$e,ENUM_TYPE_DEFINITION:()=>ht,ENUM_TYPE_EXTENSION:()=>Tt,ENUM_VALUE_DEFINITION:()=>gt,FIELD:()=>Ve,FIELD_DEFINITION:()=>dt,FLOAT:()=>Ye,FRAGMENT_ARGUMENT:()=>Ue,FRAGMENT_DEFINITION:()=>Ke,FRAGMENT_SPREAD:()=>We,INLINE_FRAGMENT:()=>Ge,INPUT_OBJECT_TYPE_DEFINITION:()=>_t,INPUT_OBJECT_TYPE_EXTENSION:()=>Et,INPUT_VALUE_DEFINITION:()=>ft,INT:()=>Je,INTERFACE_TYPE_DEFINITION:()=>pt,INTERFACE_TYPE_EXTENSION:()=>Ct,LIST:()=>et,LIST_TYPE:()=>at,MEMBER_COORDINATE:()=>Ot,NAME:()=>Ie,NAMED_TYPE:()=>it,NON_NULL_TYPE:()=>ot,NULL:()=>Qe,OBJECT:()=>tt,OBJECT_FIELD:()=>nt,OBJECT_TYPE_DEFINITION:()=>ut,OBJECT_TYPE_EXTENSION:()=>St,OPERATION_DEFINITION:()=>Re,OPERATION_TYPE_DEFINITION:()=>ct,SCALAR_TYPE_DEFINITION:()=>lt,SCALAR_TYPE_EXTENSION:()=>xt,SCHEMA_DEFINITION:()=>st,SCHEMA_EXTENSION:()=>yt,SELECTION_SET:()=>Be,STRING:()=>Xe,TYPE_COORDINATE:()=>Dt,UNION_TYPE_DEFINITION:()=>mt,UNION_TYPE_EXTENSION:()=>wt,VARIABLE:()=>qe,VARIABLE_DEFINITION:()=>ze}),Ie=`Name`,Le=`Document`,Re=`OperationDefinition`,ze=`VariableDefinition`,Be=`SelectionSet`,Ve=`Field`,He=`Argument`,Ue=`FragmentArgument`,We=`FragmentSpread`,Ge=`InlineFragment`,Ke=`FragmentDefinition`,qe=`Variable`,Je=`IntValue`,Ye=`FloatValue`,Xe=`StringValue`,Ze=`BooleanValue`,Qe=`NullValue`,$e=`EnumValue`,et=`ListValue`,tt=`ObjectValue`,nt=`ObjectField`,rt=`Directive`,it=`NamedType`,at=`ListType`,ot=`NonNullType`,st=`SchemaDefinition`,ct=`OperationTypeDefinition`,lt=`ScalarTypeDefinition`,ut=`ObjectTypeDefinition`,dt=`FieldDefinition`,ft=`InputValueDefinition`,pt=`InterfaceTypeDefinition`,mt=`UnionTypeDefinition`,ht=`EnumTypeDefinition`,gt=`EnumValueDefinition`,_t=`InputObjectTypeDefinition`,vt=`DirectiveDefinition`,yt=`SchemaExtension`,bt=`DirectiveExtension`,xt=`ScalarTypeExtension`,St=`ObjectTypeExtension`,Ct=`InterfaceTypeExtension`,wt=`UnionTypeExtension`,Tt=`EnumTypeExtension`,Et=`InputObjectTypeExtension`,Dt=`TypeCoordinate`,Ot=`MemberCoordinate`,kt=`ArgumentCoordinate`,At=`DirectiveCoordinate`,jt=`DirectiveArgumentCoordinate`;function Mt(e,t){if(!e)throw Error(t)}function G(e){return e===9||e===32}function Nt(e,t){let n=e.replaceAll(`"""`,`\\"""`),r=n.split(/\r\n|[\n\r]/g),i=r.length===1,a=r.length>1&&r.slice(1).every(e=>e.length===0||G(e.charCodeAt(0))),o=n.endsWith(`\\"""`),s=e.endsWith(`"`)&&!o,c=e.endsWith(`\\`),l=s||c,u=!t?.minimize&&(!i||e.length>70||l||a||o),d=``,f=i&&G(e.charCodeAt(0));return(u&&!f||a)&&(d+=`
`),d+=n,(u||l)&&(d+=`
`),`"""`+d+`"""`}function Pt(e){return`"${e.replace(Ft,It)}"`}var Ft=/[\x00-\x1f\x22\x5c\x7f-\x9f]/g;function It(e){return Lt[e.charCodeAt(0)]}var Lt=`\\u0000.\\u0001.\\u0002.\\u0003.\\u0004.\\u0005.\\u0006.\\u0007.\\b.\\t.\\n.\\u000B.\\f.\\r.\\u000E.\\u000F.\\u0010.\\u0011.\\u0012.\\u0013.\\u0014.\\u0015.\\u0016.\\u0017.\\u0018.\\u0019.\\u001A.\\u001B.\\u001C.\\u001D.\\u001E.\\u001F...\\"..........................................................\\\\...................................\\u007F.\\u0080.\\u0081.\\u0082.\\u0083.\\u0084.\\u0085.\\u0086.\\u0087.\\u0088.\\u0089.\\u008A.\\u008B.\\u008C.\\u008D.\\u008E.\\u008F.\\u0090.\\u0091.\\u0092.\\u0093.\\u0094.\\u0095.\\u0096.\\u0097.\\u0098.\\u0099.\\u009A.\\u009B.\\u009C.\\u009D.\\u009E.\\u009F`.split(`.`),Rt=Object.freeze({});function zt(e,t,n=U){let r=new Map;for(let e of Object.values(Fe))r.set(e,Bt(t,e));let i,a=Array.isArray(e),o=[e],s=-1,c=[],l=e,u,d,f=[],p=[];do{s++;let e=s===o.length,m=e&&c.length!==0;if(e){if(u=p.length===0?void 0:f[f.length-1],l=d,d=p.pop(),m)if(a){l=l.slice();let e=0;for(let[t,n]of c){let r=t-e;n===null?(l.splice(r,1),e++):l[r]=n}}else{l={...l};for(let[e,t]of c)l[e]=t}s=i.index,o=i.keys,c=i.edits,a=i.inArray,i=i.prev}else if(d!=null){if(u=a?s:o[s],l=d[u],l==null)continue;f.push(u)}let h;if(!Array.isArray(l)){if(W(l)||Mt(!1,`Invalid AST Node: ${Oe(l)}.`),h=(e?r.get(l.kind)?.leave:r.get(l.kind)?.enter)?.call(t,l,u,d,f,p),h===Rt)break;if(h===!1){if(!e){f.pop();continue}}else if(h!==void 0&&(c.push([u,h]),!e))if(W(h))l=h;else{f.pop();continue}}h===void 0&&m&&c.push([u,l]),e?f.pop():(i={inArray:a,index:s,keys:o,edits:c,prev:i},a=Array.isArray(l),o=a?l:n[l.kind]??[],s=-1,c=[],d!=null&&p.push(d),d=l)}while(i!==void 0);return c.length===0?e:c.at(-1)[1]}function Bt(e,t){let n=e[t];return typeof n==`object`?n:typeof n==`function`?{enter:n,leave:void 0}:{enter:e.enter,leave:e.leave}}function K(e){return zt(e,Vt)}var q=80,Vt={Name:{leave:e=>e.value},Variable:{leave:e=>`$`+e.name},Document:{leave:e=>J(e.definitions,`

`)},OperationDefinition:{leave(e){let t=Q(e.variableDefinitions)?X(`(
`,J(e.variableDefinitions,`
`),`
)`):X(`(`,J(e.variableDefinitions,`, `),`)`),n=X(``,e.description,`
`)+J([e.operation,J([e.name,t]),J(e.directives,` `)],` `);return(n===`query`?``:n+` `)+e.selectionSet}},VariableDefinition:{leave:({variable:e,type:t,defaultValue:n,directives:r,description:i})=>X(``,i,`
`)+e+`: `+t+X(` = `,n)+X(` `,J(r,` `))},SelectionSet:{leave:({selections:e})=>Y(e)},Field:{leave({alias:e,name:t,arguments:n,directives:r,selectionSet:i}){return J([$(J([X(``,e,`: `),t],``),n),X(` `,J(r,` `)),X(` `,i)])}},Argument:{leave:({name:e,value:t})=>e+`: `+t},FragmentArgument:{leave:({name:e,value:t})=>e+`: `+t},FragmentSpread:{leave:({name:e,arguments:t,directives:n})=>$(`...`+e,t)+X(` `,J(n,` `))},InlineFragment:{leave:({typeCondition:e,directives:t,selectionSet:n})=>J([`...`,X(`on `,e),J(t,` `),n],` `)},FragmentDefinition:{leave:({name:e,typeCondition:t,variableDefinitions:n,directives:r,selectionSet:i,description:a})=>X(``,a,`
`)+`fragment ${e}${X(`(`,J(n,`, `),`)`)} on ${t} ${X(``,J(r,` `),` `)}`+i},IntValue:{leave:({value:e})=>e},FloatValue:{leave:({value:e})=>e},StringValue:{leave:({value:e,block:t})=>t===!0?Nt(e):Pt(e)},BooleanValue:{leave:({value:e})=>e?`true`:`false`},NullValue:{leave:()=>`null`},EnumValue:{leave:({value:e})=>e},ListValue:{leave:({values:e})=>{let t=`[`+J(e,`, `)+`]`;return t.length>q?`[
`+Z(J(e,`
`))+`
]`:t}},ObjectValue:{leave:({fields:e})=>{let t=`{ `+J(e,`, `)+` }`;return t.length>q?Y(e):t}},ObjectField:{leave:({name:e,value:t})=>e+`: `+t},Directive:{leave:({name:e,arguments:t})=>`@`+e+X(`(`,J(t,`, `),`)`)},NamedType:{leave:({name:e})=>e},ListType:{leave:({type:e})=>`[`+e+`]`},NonNullType:{leave:({type:e})=>e+`!`},SchemaDefinition:{leave:({description:e,directives:t,operationTypes:n})=>X(``,e,`
`)+J([`schema`,J(t,` `),Y(n)],` `)},OperationTypeDefinition:{leave:({operation:e,type:t})=>e+`: `+t},ScalarTypeDefinition:{leave:({description:e,name:t,directives:n})=>X(``,e,`
`)+J([`scalar`,t,J(n,` `)],` `)},ObjectTypeDefinition:{leave:({description:e,name:t,interfaces:n,directives:r,fields:i})=>X(``,e,`
`)+J([`type`,t,X(`implements `,J(n,` & `)),J(r,` `),Y(i)],` `)},FieldDefinition:{leave:({description:e,name:t,arguments:n,type:r,directives:i})=>X(``,e,`
`)+t+(Q(n)?X(`(
`,Z(J(n,`
`)),`
)`):X(`(`,J(n,`, `),`)`))+`: `+r+X(` `,J(i,` `))},InputValueDefinition:{leave:({description:e,name:t,type:n,defaultValue:r,directives:i})=>X(``,e,`
`)+J([t+`: `+n,X(`= `,r),J(i,` `)],` `)},InterfaceTypeDefinition:{leave:({description:e,name:t,interfaces:n,directives:r,fields:i})=>X(``,e,`
`)+J([`interface`,t,X(`implements `,J(n,` & `)),J(r,` `),Y(i)],` `)},UnionTypeDefinition:{leave:({description:e,name:t,directives:n,types:r})=>X(``,e,`
`)+J([`union`,t,J(n,` `),X(`= `,J(r,` | `))],` `)},EnumTypeDefinition:{leave:({description:e,name:t,directives:n,values:r})=>X(``,e,`
`)+J([`enum`,t,J(n,` `),Y(r)],` `)},EnumValueDefinition:{leave:({description:e,name:t,directives:n})=>X(``,e,`
`)+J([t,J(n,` `)],` `)},InputObjectTypeDefinition:{leave:({description:e,name:t,directives:n,fields:r})=>X(``,e,`
`)+J([`input`,t,J(n,` `),Y(r)],` `)},DirectiveDefinition:{leave:({description:e,name:t,arguments:n,directives:r,repeatable:i,locations:a})=>X(``,e,`
`)+`directive @`+t+(Q(n)?X(`(
`,Z(J(n,`
`)),`
)`):X(`(`,J(n,`, `),`)`))+X(` `,J(r,` `))+(i?` repeatable`:``)+` on `+J(a,` | `)},SchemaExtension:{leave:({directives:e,operationTypes:t})=>J([`extend schema`,J(e,` `),Y(t)],` `)},ScalarTypeExtension:{leave:({name:e,directives:t})=>J([`extend scalar`,e,J(t,` `)],` `)},ObjectTypeExtension:{leave:({name:e,interfaces:t,directives:n,fields:r})=>J([`extend type`,e,X(`implements `,J(t,` & `)),J(n,` `),Y(r)],` `)},InterfaceTypeExtension:{leave:({name:e,interfaces:t,directives:n,fields:r})=>J([`extend interface`,e,X(`implements `,J(t,` & `)),J(n,` `),Y(r)],` `)},UnionTypeExtension:{leave:({name:e,directives:t,types:n})=>J([`extend union`,e,J(t,` `),X(`= `,J(n,` | `))],` `)},EnumTypeExtension:{leave:({name:e,directives:t,values:n})=>J([`extend enum`,e,J(t,` `),Y(n)],` `)},InputObjectTypeExtension:{leave:({name:e,directives:t,fields:n})=>J([`extend input`,e,J(t,` `),Y(n)],` `)},DirectiveExtension:{leave:({name:e,directives:t})=>J([`extend directive @`+e,J(t,` `)],` `)},TypeCoordinate:{leave:({name:e})=>e},MemberCoordinate:{leave:({name:e,memberName:t})=>J([e,X(`.`,t)])},ArgumentCoordinate:{leave:({name:e,fieldName:t,argumentName:n})=>J([e,X(`.`,t),X(`(`,n,`:)`)])},DirectiveCoordinate:{leave:({name:e})=>J([`@`,e])},DirectiveArgumentCoordinate:{leave:({name:e,argumentName:t})=>J([`@`,e,X(`(`,t,`:)`)])}};function J(e,t=``){return e?.filter(e=>e!==void 0&&e!==``).join(t)??``}function Y(e){return X(`{
`,Z(J(e,`
`)),`
}`)}function X(e,t,n=``){return t!=null&&t!==``?e+t+n:``}function Z(e){return X(`  `,e.replaceAll(`
`,`
  `))}function Q(e){return e?.some(e=>e.includes(`
`))??!1}function $(e,t){let n=e+X(`(`,J(t,`, `),`)`);return n.length>q&&(n=e+X(`(
`,Z(J(t,`
`)),`
)`)),n}var Ht=class extends Error{},Ut=Symbol.for(`@mysten/SuiGraphQLClient`),Wt=class extends ue{#e;#t;#n;#r;get mvr(){return this.core.mvr}get[Ut](){return!0}constructor({url:e,fetch:t=fetch,headers:n={},queries:r={},network:i,mvr:a}){super({network:i}),this.#e=e,this.#t=r,this.#n=n,this.#r=(...e)=>t(...e),this.core=new Se({graphqlClient:this,mvr:a})}async query(e){let t=new Headers({"Content-Type":`application/json`,...this.#n});t.has(`x-sui-client-protocol-version`)||t.set(p,`138`);let n=await this.#r(this.#e,{method:`POST`,headers:t,body:JSON.stringify({query:typeof e.query==`string`||e.query instanceof String?String(e.query):K(e.query),variables:e.variables,extensions:e.extensions,operationName:e.operationName}),signal:e.signal});if(!n.ok)throw new Ht(`GraphQL request failed: ${n.statusText} (${n.status})`);return await n.json()}async execute(e,t){return this.query({...t,query:this.#t[e]})}getObjects(e){return this.core.getObjects(e)}getObject(e){return this.core.getObject(e)}listCoins(e){return this.core.listCoins(e)}listOwnedObjects(e){return this.core.listOwnedObjects(e)}getBalance(e){return this.core.getBalance(e)}listBalances(e){return this.core.listBalances(e)}getCoinMetadata(e){return this.core.getCoinMetadata(e)}getTransaction(e){return this.core.getTransaction(e)}executeTransaction(e){return this.core.executeTransaction(e)}signAndExecuteTransaction(e){return this.core.signAndExecuteTransaction(e)}waitForTransaction(e){return this.core.waitForTransaction(e)}simulateTransaction(e){return this.core.simulateTransaction(e)}getReferenceGasPrice(e){return this.core.getReferenceGasPrice(e)}getCurrentSystemState(e){return this.core.getCurrentSystemState(e)}getProtocolConfig(e){return this.core.getProtocolConfig(e)}getChainIdentifier(e){return this.core.getChainIdentifier(e)}async listDynamicFields(t){let r=t.include?.value??!1,{data:i,errors:a}=await this.query({query:_e,signal:t.signal,variables:{parentId:t.parentId,first:t.limit,cursor:t.cursor,includeValue:r}});if(a?.length)throw a.length===1?Error(a[0].message):AggregateError(a.map(e=>Error(e.message)));let o=i?.address?.dynamicFields;if(!o)throw Error(`Missing response data`);return{dynamicFields:o.nodes.map(i=>{let a=i.value?.__typename===`MoveObject`?i.value.contents?.type?.repr:i.value?.type?.repr,o=i.value?.__typename===`MoveObject`,s=o?`0x2::dynamic_object_field::Wrapper<${i.name?.type?.repr}>`:i.name?.type?.repr,c;if(r){let t;t=i.value?.__typename===`MoveValue`?e(i.value.bcs??``):i.value?.__typename===`MoveObject`?e(i.value.contents?.bcs??``):new Uint8Array,c={type:a,bcs:t}}return{$kind:o?`DynamicObject`:`DynamicField`,fieldId:u(t.parentId,s,e(i.name?.bcs)),type:n(o?`0x2::dynamic_field::Field<0x2::dynamic_object_field::Wrapper<${i.name?.type?.repr}>,0x2::object::ID>`:`0x2::dynamic_field::Field<${i.name?.type?.repr},${a}>`),name:{type:i.name?.type?.repr,bcs:e(i.name?.bcs)},valueType:a,childId:o&&i.value?.__typename===`MoveObject`?i.value.address:void 0,value:r?c:void 0}}),cursor:o.pageInfo.endCursor??null,hasNextPage:o.pageInfo.hasNextPage}}getDynamicField(e){return this.core.getDynamicField(e)}getDynamicObjectField(e){return this.core.getDynamicObjectField(e)}listTransactions(e){return this.core.listTransactions(e)}listEvents(e){return this.core.listEvents(e)}getMoveFunction(e){return this.core.getMoveFunction(e)}resolveTransactionPlugin(){return this.core.resolveTransactionPlugin()}verifyZkLoginSignature(e){return this.core.verifyZkLoginSignature(e)}defaultNameServiceName(e){return this.core.defaultNameServiceName(e)}resolveNameServiceAddress(e){return this.core.resolveNameServiceAddress(e)}};export{Wt as SuiGraphQLClient};