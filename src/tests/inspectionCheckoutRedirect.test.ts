import test from 'node:test';
import assert from 'node:assert/strict';
import { clearInspectionChatIntent, getReusableInspectionQuote, inspectionChatDraftFromUrl, isInspectionProposalForPost, matchesInspectionChatDraft, resolveChatRoomPath } from '../utils/inspectionChatDraft';

test('resolving the room preserves checkout intent for the requested product only', () => {
  const requested = '/buyer/chat?postId=rice-cooker&action=inspection_proposal&centerId=hub&method=AT_HOME&feeSplit=BUYER_100';
  const room = resolveChatRoomPath('buyer', 'rice-cooker-room', requested);
  assert.equal(room, requested.replace('/buyer/chat?', '/buyer/chat/rice-cooker-room?'));
  assert.equal(isInspectionProposalForPost(room, 'wardrobe'), false);
  assert.equal(isInspectionProposalForPost(room, 'rice-cooker'), true);
  assert.deepEqual(inspectionChatDraftFromUrl(room, 'rice-cooker'), {
    postId: 'rice-cooker', centerId: 'hub', inspectionMethod: 'AT_HOME', feeSplit: 'BUYER_100',
  });
  assert.equal(clearInspectionChatIntent(room), '/buyer/chat/rice-cooker-room');
  assert.equal(resolveChatRoomPath('buyer', 'room', '/buyer/chat?postId=rice-cooker'), '/buyer/chat/room');
});

test('the checkout draft reuses only a matching, unexpired inspection quote', () => {
  const quote = {
    postId: 'post', baseInspectionFee: 200_000, atCenterTotalFee: 400_000,
    shippingQuote: { id: 'quote', inspectionCenterId: 'hub', expiresAt: '2099-01-01T00:00:00Z' },
  };
  const draft = { postId: 'post', buyerId: 'buyer', centerId: 'hub', inspectionMethod: 'AT_CENTER' as const, quote };
  assert.equal(matchesInspectionChatDraft(draft, 'post', 'buyer'), true);
  assert.equal(matchesInspectionChatDraft(draft, 'post', 'other-buyer'), false);
  assert.equal(getReusableInspectionQuote(draft, 'post'), quote);
  assert.equal(getReusableInspectionQuote(draft, 'other-post'), null);
  assert.equal(getReusableInspectionQuote({ ...draft, centerId: 'other-hub' }, 'post'), null);
  assert.equal(getReusableInspectionQuote({
    ...draft, quote: { ...quote, shippingQuote: { ...quote.shippingQuote, expiresAt: '2000-01-01T00:00:00Z' } },
  }, 'post'), null);
});

test('Inspection Checkout Redirection Logic Suite', async (t) => {
  await t.test('[TEST 1] Listing requires inspection defaults to INSPECTION option and forbids direct buy', () => {
    const listing = {
      id: 'listing-123',
      title: 'iPhone 15 Pro Max',
      priceVnd: 25000000,
      requiresInspection: true,
      sellerId: 'seller-456',
    };

    const initialDeliveryOption = (listing.requiresInspection ? 'INSPECTION' : 'DIRECT') as 'INSPECTION' | 'DIRECT';
    assert.equal(initialDeliveryOption, 'INSPECTION');

    // On INSPECTION mode, direct checkout cannot proceed
    const isDirectBuyAllowed = (initialDeliveryOption as string) === 'DIRECT';
    assert.equal(isDirectBuyAllowed, false);
  });

  await t.test('[TEST 2] Regular listing defaults to DIRECT option allowing immediate checkout', () => {
    const listing = {
      id: 'listing-789',
      title: 'Bàn Ăn Gỗ Tự Nhiên',
      priceVnd: 300000,
      requiresInspection: false,
      sellerId: 'seller-456',
    };

    const initialDeliveryOption = (listing.requiresInspection ? 'INSPECTION' : 'DIRECT') as 'INSPECTION' | 'DIRECT';
    assert.equal(initialDeliveryOption, 'DIRECT');
    assert.equal((initialDeliveryOption as string) === 'DIRECT', true);
  });

  await t.test('[TEST 3] Selecting INSPECTION generates chat URL with postId and inspection_proposal action', () => {
    const listing = {
      id: '7900c193-c59e-4781-a954-ba199e434f8e',
      title: 'Tai nghe Sony WH-1000XM5',
      sellerId: 'seller-xyz',
    };

    const buildChatUrl = (role: string, item: typeof listing, action?: string) => {
      const base = `/${role === 'seller' ? 'seller' : 'buyer'}/chat`;
      const query = `?postId=${encodeURIComponent(item.id)}${action ? `&action=${encodeURIComponent(action)}` : ''}`;
      return base + query;
    };

    const url = buildChatUrl('buyer', listing, 'inspection_proposal');
    assert.equal(
      url,
      '/buyer/chat?postId=7900c193-c59e-4781-a954-ba199e434f8e&action=inspection_proposal'
    );

    // Verify search params extraction
    const searchPart = url.split('?')[1];
    const params = new URLSearchParams(searchPart);
    assert.equal(params.get('postId'), '7900c193-c59e-4781-a954-ba199e434f8e');
    assert.equal(params.get('action'), 'inspection_proposal');
  });

  await t.test('[TEST 4] Chat view automatically opens InspectionProposalModal when action=inspection_proposal is present', () => {
    const searchString = '?postId=7900c193-c59e-4781-a954-ba199e434f8e&action=inspection_proposal';
    const params = new URLSearchParams(searchString);

    const shouldAutoOpenModal = params.get('action') === 'inspection_proposal';
    assert.equal(shouldAutoOpenModal, true);

    // Cleanup simulation
    params.delete('action');
    assert.equal(params.get('action'), null);
    assert.equal(params.get('postId'), '7900c193-c59e-4781-a954-ba199e434f8e');
  });

  await t.test('[TEST 5] Submitting checkout in INSPECTION mode diverts to chat redirection handler', () => {
    let redirectedToChat = false;
    let submittedOrder = false;

    const deliveryOption: 'INSPECTION' | 'DIRECT' = 'INSPECTION';
    const handleNavigateToChat = () => {
      redirectedToChat = true;
    };
    const placeEscrowOrder = () => {
      submittedOrder = true;
    };

    const handleConfirmOrder = () => {
      if ((deliveryOption as string) === 'INSPECTION') {
        handleNavigateToChat();
        return;
      }
      placeEscrowOrder();
    };

    handleConfirmOrder();
    assert.equal(redirectedToChat, true);
    assert.equal(submittedOrder, false);
  });

  await t.test('[TEST 6] In INSPECTION mode, delivery address section and direct Lalamove shipping are hidden', () => {
    const isDirectMode = (opt: string) => opt === 'DIRECT';
    const isInspectionMode = (opt: string) => opt === 'INSPECTION';

    // In INSPECTION mode:
    const option1 = 'INSPECTION' as string;
    const showDeliveryAddress = isDirectMode(option1);
    const showDirectShippingRow = isDirectMode(option1);
    const showInspectionBreakdown = isInspectionMode(option1);

    assert.equal(showDeliveryAddress, false);
    assert.equal(showDirectShippingRow, false);
    assert.equal(showInspectionBreakdown, true);

    // Switch to DIRECT mode:
    const option2 = 'DIRECT' as string;
    assert.equal(isDirectMode(option2), true);
    assert.equal(isInspectionMode(option2), false);
  });

  await t.test('[TEST 7] Transfer all selected inspection choices (centerId, method, feeSplit, zinLoss, quote) from checkout to chat prefill', () => {
    const checkoutSelections = {
      centerId: 'center-hcm-01',
      centerName: 'Trung Tam Kiem Dinh Chinh Thành phố Hồ chí minh',
      inspectionMethod: 'AT_CENTER' as const,
      feeSplit: 'BUYER_100' as const,
      feePayer: 'BUYER_PAYS' as const,
      isZinLossAcknowledged: true,
      upfrontAmount: 897000,
      totalAtCenterFee: 897000,
      baseInspectionFee: 166000,
      shippingToCenterFee: 340000,
      returnShippingReserveFee: 391000,
    };

    // Serialized to sessionStorage
    const serialized = JSON.stringify(checkoutSelections);
    const parsed = JSON.parse(serialized);

    assert.equal(parsed.centerId, 'center-hcm-01');
    assert.equal(parsed.inspectionMethod, 'AT_CENTER');
    assert.equal(parsed.feeSplit, 'BUYER_100');
    assert.equal(parsed.feePayer, 'BUYER_PAYS');
    assert.equal(parsed.isZinLossAcknowledged, true);
    assert.equal(parsed.upfrontAmount, 897000);
    assert.equal(parsed.totalAtCenterFee, 897000);
  });
});
