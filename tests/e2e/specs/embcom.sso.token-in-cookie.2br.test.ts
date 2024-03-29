/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
import fs = require('fs');
import server = require('../utils/server');
import u = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');

import * as Paseto from 'paseto.js';


// Dupl code  [embcom_sso_e2e_dupl]

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;

let maria: Member;
let maria_brB: TyE2eTestBrowser;

let selina_brB: TyE2eTestBrowser;
const selinaExtUser: ExternalUser = {
  ssoId: 'selina-soid',
  username: 'selina_un',
  fullName: 'Selina Full Name',
  primaryEmailAddress: 'e2e-test-selina@x.co',
  isEmailAddressVerified: true,
}

const selinaAutnhMsg = {
  //sub: 'ject',
  //exp: '2021-05-01T00:00:00Z',
  //iat: '2021-05-01T00:00:00Z',
  data: {
    //ifExists: 'DoNothing', // or 'Update'
    //lookupKey: 'soid:selina_sign_on_id',
    user: {
      ...selinaExtUser,
    },
  },
};


const localHostname = 'comments-for-e2e-test-embsth-localhost-8080';
const embeddingOrigin = 'http://e2e-test-embsth.localhost:8080';

let site: IdAddress;
let forum: TwoCatsTestForum;


const ssoUrl =
    `http://localhost:8080/${u.ssoLoginPageSlug}?returnPath=\${talkyardPathQueryEscHash}`;

const ssoUrlVarsReplaced = (path: string): string =>
    `http://localhost:8080/${u.ssoLoginPageSlug}?returnPath=${path}`;


let pasetoV2LocalSecret = '';



describe(`embcom.sso.token-in-cookie.2br.test.ts  TyTE2EEMBSSO2`, () => {

  it(`Construct site`, () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Some E2E Test",
      members: ['memah', 'maria', 'michael']
    });

    builder.getSite().meta.localHostname = localHostname;
    builder.getSite().settings.allowEmbeddingFrom = embeddingOrigin;

    // Disable notifications, or notf email counts will be off
    // (since Owen would get emails).
    builder.settings({
      numFirstPostsToApprove: 0,
      numFirstPostsToReview: 0,
      enableApi: true,
    });

    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.EveryPost,
      wholeSite: true,
    }];

    brA = new TyE2eTestBrowser(wdioBrowserA);
    brB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owen_brA = brA;

    maria_brB = brB;
    maria = forum.members.maria;

    selina_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  it(`Owen logs in to admin area, ... `, () => {
    owen_brA.adminArea.settings.login.goHere(site.origin, { loginAs: owen });
  });

  it(`... and types an SSO login URL`, () => {
    owen_brA.scrollToBottom(); // just speeds the test up slightly
    owen_brA.adminArea.settings.login.typeSsoUrl(ssoUrl);
  });

  it(`... and enables SSO`, () => {
    owen_brA.adminArea.settings.login.setEnableSso(true);
  });

  it(`... generates a PASETO v2.local shared secret`, () => {
    owen_brA.adminArea.settings.login.generatePasetoV2LocalSecret();
  });

  it(`... copies the secret`, () => {
    pasetoV2LocalSecret = owen_brA.adminArea.settings.login.copyPasetoV2LocalSecret();
  });

  it(`... and saves the new settings`, () => {
    owen_brA.adminArea.settings.clickSaveAll();
  });

  it(`There are external SSO login pages`, () => {
    u.createSingleSignOnPagesInHtmlDir();
  });


  let sharedSecretKeyBytes;


  let selinasToken: St | U;

  it(`An external server converts the symmetric secret to bytes`, () => {
    const pasetoV2LocalSecretNoHexPrefix = pasetoV2LocalSecret.replace(/^hex:/, '');
    sharedSecretKeyBytes = Buffer.from(
            pasetoV2LocalSecretNoHexPrefix, 'hex');
            // 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', 'hex');
  });

  it(`The external server generates a login token for Selina`, async () => {
    // Dupl code [.e2e_encr_paseto]
    const messageAsSt = JSON.stringify(selinaAutnhMsg);
    const sharedSecretKey  = new Paseto.SymmetricKey(new Paseto.V2());
    selinasToken = await sharedSecretKey.inject(sharedSecretKeyBytes).then(() => {
      const encoder = sharedSecretKey.protocol();
      return encoder.encrypt(messageAsSt, sharedSecretKey);
    }).then(token => {
      console.log(`Generated PASETO token for Selina:  ${token}`);
      // E.g. "v2.local.kBENRnu2p2.....JKJZB9Lw"
      return 'paseto:' + token;
    });;
  });



  let badAuthnToken: St | U;

  it(`... a bad login token appears from nowhere (!)`, async () => {
    // Dupl code [.e2e_encr_paseto]
    const messageAsSt = JSON.stringify(selinaAutnhMsg);
    const badKeyBytes = Buffer.from(
            'bad00bad00bad00bad00beefdeadbeefdeadbeefdeadbeefdeadbeefbaadbeef', 'hex');
    const wrongKey  = new Paseto.SymmetricKey(new Paseto.V2());
    badAuthnToken = await wrongKey.inject(badKeyBytes).then(() => {
      const encoder = wrongKey.protocol();
      return encoder.encrypt(messageAsSt, wrongKey);
    }).then(token => {
      console.log(`Generated bad PASETO token:  ${token}`);
      return 'paseto:' + token;
    });;
  });



  it(`There's a website with embedding pages`, () => {
    const dir = 'target';
    fs.writeFileSync(`${dir}/so-as-selina-cookie.html`,
            makeHtml('aaa', '#050', selinasToken));
    fs.writeFileSync(`${dir}/so-no-token-cookie.html`,
            makeHtml('bbb', '#500'));
    fs.writeFileSync(`${dir}/so-bad-token-cookie.html`,
            makeHtml('bbb', '#500', badAuthnToken));
    fs.writeFileSync(`${dir}/so-as-selina-var-and-cookie.html`,
            makeHtml('bbb', '#520', selinasToken, selinasToken));
    fs.writeFileSync(`${dir}/so-different-var-cookie-token.html`,
            makeHtml('bbb', '#502', selinasToken, 'v2.local.DIFFERENT_AND_WRONG'));

    function makeHtml(pageName: St, bgColor: St, authnTokenCookie?: St,
              authnToken?: St): St {
      return u.makeEmbeddedCommentsHtml({
              pageName, discussionId: '', authnTokenCookie, authnToken,
              localHostname, bgColor});
    }
  });


  // To ttt (tests the tests).
  function assertAuthnToken(ps: { html: St, inCookie?: true, inVar?: true }) {
    const cookieMatch =
            ps.html.match(/^\s*document\.cookie\s*=.*TalkyardAuthnToken\s*=.*$/gm);
    const varMatch =
            ps.html.match(/^(\s*var)?\s*talkyardAuthnToken\s*=.*$/gm);
    let ok = true;
    if (ps.inCookie) ok &&= !!cookieMatch;
    else ok &&= cookieMatch === null;
    if (ps.inVar) ok &&= !!varMatch;
    else ok &&= varMatch === null;
    assert.that(ok, `Broken test: HTML source has/hasn't cookie or var token:\n` +
          `Expected: ${JSON.stringify({ inCookie: ps.inCookie, inVar: ps.inVar })}\n` +
          `Actual: ${JSON.stringify({ cookieMatch, varMatch })}\n` +
          `Source: -----------\n` +
          ps.html + '\n' +
          `-------------------\n\n`);
  }



  // ----- Good token

  it(`Selina opens embedding page aaa`, () => {
    selina_brB.go2(embeddingOrigin + '/so-as-selina-cookie.html');
  });
  it(`There's no authn token variable, instead, a cookie  ttt`, () => {
    const html = selina_brB.getPageSource();
    assertAuthnToken({ html, inCookie: true });
  });
  it(`... can reply directly, auto logged in via PASETO token *in cookie*`, () => {
    selina_brB.complex.replyToEmbeddingBlogPost("I logged_in_via_a_PASETO_token cookie");
  });

  it(`There's no logout button — not included, when auto logged in via token,
          then, the embedd*ing* page manages login/out
          by including/excluding a PASETO token   UNIMPL   [hide_authn_btns]`, () => {
    // assert.not(selina_brB.metabar.isLogoutBtnDisplayed());
  });
  it(`... and no login button  (already logged in)`, () => {
    assert.not(selina_brB.metabar.isLoginButtonDisplayed());
  });



  // ----- No token

  it(`Selina goes to a page without any token — not in var, nor in cookie`, () => {
    selina_brB.go2('/so-no-token-cookie.html');
    selina_brB.switchToEmbeddedCommentsIrame();
    selina_brB.metabar.waitForDisplayed();
  });
  it(`... there's no authn token anywhere   ttt`, () => {
    const html = selina_brB.getPageSource();
    assertAuthnToken({ html });
  });
  it(`... she's NOT logged in, because auto token sessions are NOT remembered
        across page reloads`, () => {
    // ttt  [.648927]
    selina_brB.complex.waitForNotLoggedInInEmbeddedCommentsIframe({
          willBeLoginBtn: false });  // hmm [.is_or_isnt] [hide_authn_btns]
    selina_brB.switchToEmbeddedCommentsIrame();
    assert.not(selina_brB.metabar.isMyUsernameVisible());
  });
  it(`... there's a Login button`, () => {
    assert.ok(selina_brB.metabar.isLoginButtonDisplayed());  // hmm [.is_or_isnt]
  });
  it(`... no logout button  UNIMPL   [hide_authn_btns]`, () => {
    //assert.not(selina_brB.metabar.isLogoutBtnDisplayed());
  });



  // ----- Bad token

  it(`Selina goes to a page but The Token is Bad In The Cookie!`, () => {
    selina_brB.go2(embeddingOrigin + '/so-bad-token-cookie.html');
  });
  it(`... there's a cookie token   ttt`, () => {
    const html = selina_brB.getPageSource();
    assertAuthnToken({ html, inCookie: true });
  });
  it(`... it's bad; there's a server error dialog`, () => {
    selina_brB.switchToEmbeddedCommentsIrame();
    selina_brB.serverErrorDialog.waitAndAssertTextMatches('TyEPASSECEX_');
  });


  // ----- Token in both var and cookie

  it(`Selina goes to a page ...`, () => {
    selina_brB.go2(embeddingOrigin + '/so-as-selina-var-and-cookie.html');
  });
  it(`... with both a cookie token and a var token — they're the same`, () => {
    const html = selina_brB.getPageSource();
    assertAuthnToken({ html, inCookie: true, inVar: true });
  });
  it(`... she's logged in, can reply`, () => {
    selina_brB.switchToEmbeddedCommentsIrame();
    selina_brB.me.waitUntilLoggedIn();
  });
  it(`... can reply`, () => {
    selina_brB.complex.replyToEmbeddingBlogPost(
            "I logged_in_via_a_PASETO_token in both js var, and cookie");
  });


  // ----- Two different tokens

  it(`Selina goes to a page w both cookie and var token, they're different`, () => {
    selina_brB.go2(embeddingOrigin + '/so-different-var-cookie-token.html');
    const html = selina_brB.getPageSource();
    assertAuthnToken({ html, inCookie: true, inVar: true });
  });
  it(`... she does not get logged in — Ty doesn't know which token to use`, () => {
    selina_brB.switchToEmbeddedCommentsIrame();
    selina_brB.me.waitUntilKnowsNotLoggedIn();
  });


});

