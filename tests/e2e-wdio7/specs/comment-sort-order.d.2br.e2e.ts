/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as utils from '../utils/utils';
import * as make from '../utils/make';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import { dieIf } from '../utils/log-and-die';
import c from '../test-constants';
import { execSync } from 'child_process';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let mons: Member;
let mons_brA: TyE2eTestBrowser;
let modya: Member;
let modya_brA: TyE2eTestBrowser;
let corax: Member;
let corax_brA: TyE2eTestBrowser;
let regina: Member;
let regina_brB: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;
let michael: Member;
let michael_brB: TyE2eTestBrowser;
let mallory: Member;
let mallory_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

let sortedPage: PageJustAdded;
let defaultPage: PageJustAdded;

const firstNestedReplyNr = 6;
const firstNestedNestedReplyNr = 10;
const parentOfNestedNr = c.ThirdReplyNr;   // = 4
const parentOfNestedNestedNr = firstNestedReplyNr + 2;  // = 8


describe(`comment-sort-order.d.2br  TyTECOMSORTORD`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Comt Order E2E Test",
      categoryAExtId: 'cat_a_ext_id',
      members: undefined, // default = everyone
        // ['mons', 'modya', 'regina', 'corax', 'memah', 'maria', 'michael', 'mallory']
    });


    defaultPage = builder.addPage({
      id: 'defaultOrderId',
      folder: '/',
      showId: false,
      slug: 'default-order',
      role: c.TestPageRole.Discussion,
      title: "Default order",
      body: "Default comments sort order.",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.maria.id,
    });
    builder.addPost({
      page: defaultPage,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post nr 2 — the first reply, won't move.",
    });
    builder.addPost({
      page: defaultPage,
      nr: c.SecondReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post 3 — the 2nd reply, won't move.",
    });
    builder.addPost({
      page: defaultPage,
      nr: c.ThirdReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post 4 — the 3rd reply, won't move.",
    });


    sortedPage = builder.addPage({
      id: 'editedOrderId',
      folder: '/',
      showId: false,
      slug: 'edited-order',
      role: c.TestPageRole.Discussion,
      title: "Comments sort order edited",
      body: "Let's sort of sort out the sort order.",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.maria.id,
    });

    // Direct replies:
    builder.addPost({
      page: sortedPage,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post nr 2 — the first reply.",
    });
    builder.addPost({
      page: sortedPage,
      nr: c.SecondReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post 3 — the 2nd reply. One Like vote.",
    });
    builder.addPost({
      page: sortedPage,
      nr: c.ThirdReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post 4 — the 3rd reply. Two Like votes.",
    });
    builder.addPost({
      page: sortedPage,
      nr: c.ThirdReplyNr + 1,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post nr 5 — the 4th reply and last OP reply.",
    });

    // Nested replies:
    builder.addPost({
      page: sortedPage,
      nr: firstNestedReplyNr,
      parentNr: parentOfNestedNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post nr 6 — the first a nested reply.",
    });
    builder.addPost({
      page: sortedPage,
      nr: firstNestedReplyNr + 1,
      parentNr: parentOfNestedNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post 7. One Like vote.",
    });
    builder.addPost({
      page: sortedPage,
      nr: firstNestedReplyNr + 2,
      parentNr: parentOfNestedNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post 8. Two Like votes.",
    });
    builder.addPost({
      page: sortedPage,
      nr: firstNestedReplyNr + 3,
      parentNr: parentOfNestedNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post nr 9, last nested.",
    });

    // Nested nested:
    builder.addPost({
      page: sortedPage,
      nr: firstNestedNestedReplyNr,
      parentNr: parentOfNestedNestedNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post nr 10 — first nested nested.",
    });
    builder.addPost({
      page: sortedPage,
      nr: firstNestedNestedReplyNr + 1,
      parentNr: parentOfNestedNestedNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post 11. One Like vote.",
    });
    builder.addPost({
      page: sortedPage,
      nr: firstNestedNestedReplyNr + 2,
      parentNr: parentOfNestedNestedNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post 12. Two Like votes.",
    });
    builder.addPost({
      page: sortedPage,
      nr: firstNestedNestedReplyNr + 3,
      parentNr: parentOfNestedNestedNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post nr 13, last nested nested.",
    });

    // To do:
    builder.addVote({
      // postId ?  — add a postActionsByNr ?
      pageId: sortedPage.id,
      postNr: 4,  // post_4_has_2_votes
      doneAt: c.JanOne2020HalfPastFive,
      doerId: forum.members.mons.id,
      actionType: c.TestVoteType.Like,
    });

// post_8_has_2_votes
// post_12_has_2_votes
// post_11_has_1_vote

// post_7_has_1_vote

// post_3_has_1_vote

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;
    mons = forum.members.mons;
    mons_brA = brA;
    modya = forum.members.modya;
    modya_brA = brA;
    corax = forum.members.corax;
    corax_brA = brA;

    regina = forum.members.regina;
    regina_brB = brB;
    maria = forum.members.maria;
    maria_brB = brB;
    memah = forum.members.memah;
    memah_brB = brB;
    michael = forum.members.michael;
    michael_brB = brB;
    mallory = forum.members.mallory;
    mallory_brB = brB;
    stranger_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  it(`Owen logs in`, async () => {
    await owen_brA.go2(site.origin + '/' + sortedPage.slug);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);

    //  openChangePageDialog()
    //  openDiscLayout()
  });


  it(`Memah logs in`, async () => {
    await memah_brB.go2(site.origin + '/' + sortedPage.slug);
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });


  it(`The comments are sorted oldest first, the built-in default`, async () => {
    await checkSortOrder(memah_brB, c.TestPostSortOrder.OldestFirst);
  });


  it(`Owen changes the sort order to newest first`, async () => {
    await owen_brA.topic.openDiscLayout();
    debugger;
  });
  it(`... now they're sorted newest first`, async () => {
    await checkSortOrder(owen_brA, c.TestPostSortOrder.NewestFirst);
  });


  it(`Memah doesn't see the changes yet`, async () => {
    await checkSortOrder(memah_brB, c.TestPostSortOrder.OldestFirst);
  });
  it(`... but she reloads the page`, async () => {
    await memah_brB.refresh2();
  });
  it(`... and sees the new sort order: Newest First`, async () => {
    await checkSortOrder(memah_brB, c.TestPostSortOrder.NewestFirst);
  });


  it(`Memah changes back, temporarily`, async () => {
    await memah_brB.metabar.openDiscLayout();
    debugger;
  });
  it(`Sort order is oldest-first again`, async () => {
    await checkSortOrder(memah_brB, c.TestPostSortOrder.OldestFirst);
  });

});


async function checkSortOrder(br: TyE2eTestBrowser, sortOrder) {
  const els = await br.$$('.dw-depth-1 .dw-p');
  const postNrTexts = await Promise.all(els.map(async el => await el.getAttribute('id')));
  const expectedOrder = expectedPostNrOrder(sortOrder);
  assert.deepEq(postNrTexts, expectedOrder.map(nr => `post-${nr}`));
};


function expectedPostNrOrder(sortOrder): Nr[] {
  assert.eq(parentOfNestedNr, 4); // ttt
  assert.eq(parentOfNestedNestedNr, 8); // ttt
  switch (sortOrder) {
    case c.TestPostSortOrder.OldestFirst:
      return [
        2,
        3,
        4,
            6,
            7,
            8,
                10,
                11,
                12,
                13,
            9,
        5]

    case c.TestPostSortOrder.NewestFirst:
      return [
        5,
        4,
            9,
            8,
                13,
                12,
                11,
                10,
            7,
            6,
        3,
        2];

    case c.TestPostSortOrder.BestFirst:
      return [
        4,            // post_4_has_2_votes
            8,        // post_8_has_2_votes
                12,   // post_12_has_2_votes
                11,   // post_11_has_1_vote
                10,
                13,
            7,        // post_7_has_1_vote
            6,
            9,
        3,            // post_3_has_1_vote
        2,
        5]

    case c.TestPostSortOrder.NewestThenBest:
      return [
        5,
        4,
            8,
                12,   // post_12_has_2_votes
                11,   // post_11_has_1_vote
                13,
                10,
            7,        // post_7_has_1_vote
            9,
            6,
        3,
        2];

    case c.TestPostSortOrder.NewestThenOldest:
      return [
        5,
        4,
            6,
            7,
            8,
                10,
                11,
                12,
                13,
            9,
        3,
        2];
  }
}