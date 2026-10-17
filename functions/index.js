const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const catalog = require('./catalog');

initializeApp();
const db = getDatabase();
const HOUR = 60 * 60 * 1000;
const HOURLY_COINS = 10;
const CALLABLE_OPTIONS = { region: 'europe-west1', maxInstances: 5 };

function requireUser(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Войдите в Pulse.');
  return request.auth.uid;
}

function requireAdmin(request) {
  const uid = requireUser(request);
  if (request.auth.token.admin !== true) throw new HttpsError('permission-denied', 'Только администратор может выдавать подарки.');
  return uid;
}

function getGift(giftType) {
  const gift = catalog[giftType];
  if (!gift) throw new HttpsError('invalid-argument', 'Такого подарка нет в каталоге.');
  return gift;
}

function getOperationId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(value)) {
    throw new HttpsError('invalid-argument', 'Не удалось проверить запрос. Повторите отправку.');
  }
  return value;
}

exports.claimHourlyCoins = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireUser(request);
  const walletRef = db.ref(`wallets/${uid}`);
  const now = Date.now();
  let granted = 0;
  const result = await walletRef.transaction((current) => {
    granted = 0;
    if (!current) {
      granted = HOURLY_COINS;
      return { coins: HOURLY_COINS, lastHourlyClaimAt: now, claimedGiftIds: {}, sentGiftOperations: {} };
    }
    const last = Number(current.lastHourlyClaimAt) || now;
    const elapsedHours = Math.floor((now - last) / HOUR);
    if (elapsedHours < 1) return;
    granted = elapsedHours * HOURLY_COINS;
    return {
      ...current,
      coins: Math.max(0, Number(current.coins) || 0) + granted,
      lastHourlyClaimAt: last + elapsedHours * HOUR,
    };
  }, undefined, false);
  const wallet = result.snapshot.val() || { coins: 0, lastHourlyClaimAt: now };
  const nextClaimAt = (Number(wallet.lastHourlyClaimAt) || now) + HOUR;
  return { coins: Number(wallet.coins) || 0, granted: result.committed ? granted : 0, nextClaimAt };
});

exports.claimGift = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireUser(request);
  const giftId = request.data?.giftId;
  if (typeof giftId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(giftId)) {
    throw new HttpsError('invalid-argument', 'Подарок не найден.');
  }
  const giftRef = db.ref(`giftInbox/${uid}/${giftId}`);
  const giftSnap = await giftRef.get();
  const gift = giftSnap.val();
  if (!gift) throw new HttpsError('not-found', 'Подарок не найден.');
  if (gift.status === 'available' && (!Number.isInteger(gift.redeemCoins) || gift.redeemCoins < 0 || gift.redeemCoins > 10000)) {
    throw new HttpsError('failed-precondition', 'У подарка неверная стоимость.');
  }

  const walletRef = db.ref(`wallets/${uid}`);
  let added = 0;
  const now = Date.now();
  const result = await walletRef.transaction((current) => {
    const wallet = current || { coins: 0, lastHourlyClaimAt: now, claimedGiftIds: {}, sentGiftOperations: {} };
    const claimed = wallet.claimedGiftIds || {};
    if (claimed[giftId]) {
      added = 0;
      return wallet;
    }
    if (gift.status !== 'available') return;
    added = gift.redeemCoins;
    return {
      ...wallet,
      coins: (Number(wallet.coins) || 0) + added,
      claimedGiftIds: { ...claimed, [giftId]: true },
    };
  }, undefined, false);
  if (!result.committed && !result.snapshot.child(`claimedGiftIds/${giftId}`).val()) {
    throw new HttpsError('failed-precondition', 'Подарок уже забрали или он недоступен.');
  }
  const finalWallet = result.snapshot.val() || {};
  await giftRef.update({ status: 'claimed', claimedAt: now });
  return { added, coins: Number(finalWallet.coins) || 0 };
});

exports.adminGrantGift = onCall(CALLABLE_OPTIONS, async (request) => {
  const adminUid = requireAdmin(request);
  const { recipientUid, giftType, message = '' } = request.data || {};
  const operationId = getOperationId(request.data?.operationId);
  const gift = getGift(giftType);
  if (typeof recipientUid !== 'string' || recipientUid.length > 128) {
    throw new HttpsError('invalid-argument', 'Выберите пользователя.');
  }
  const recipient = await db.ref(`users/${recipientUid}`).get();
  if (!recipient.exists()) throw new HttpsError('not-found', 'Пользователь не найден.');
  const operationRef = db.ref(`adminGiftOperations/${adminUid}/${operationId}`);
  const proposedGiftRef = db.ref(`giftInbox/${recipientUid}`).push();
  let operationCreated = false;
  const operationResult = await operationRef.transaction((current) => {
    operationCreated = false;
    if (current) return current;
    operationCreated = true;
    return { giftId: proposedGiftRef.key, recipientUid, giftType, createdAt: Date.now() };
  }, undefined, false);
  const operation = operationResult.snapshot.val();
  if (operation.recipientUid !== recipientUid || operation.giftType !== giftType) {
    throw new HttpsError('already-exists', 'Этот запрос уже использован для другого подарка.');
  }
  const giftRef = db.ref(`giftInbox/${recipientUid}/${operation.giftId}`);
  const safeMessage = typeof message === 'string' ? message.trim().slice(0, 120) : '';
  const record = {
    giftType: gift.id, name: gift.name, image: gift.image, redeemCoins: gift.redeemCoins,
    senderId: adminUid, senderName: 'Pulse', message: safeMessage,
    status: 'available', adminIssued: true, createdAt: Date.now(),
  };
  const giftSnap = await giftRef.get();
  if (!giftSnap.exists()) await giftRef.set(record);
  return { giftId: operation.giftId, alreadyIssued: !operationCreated };
});
