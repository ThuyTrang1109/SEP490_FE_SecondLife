import assert from 'node:assert/strict';
import test from 'node:test';
import { formatConditionGrade } from '../utils/translations';

test('formatConditionGrade translates Fair and variants to Vietnamese Khá', () => {
  assert.equal(formatConditionGrade('Fair', 'vi'), 'Khá');
  assert.equal(formatConditionGrade('fair', 'vi'), 'Khá');
  assert.equal(formatConditionGrade('FAIR', 'vi'), 'Khá');
  assert.equal(formatConditionGrade('USED_FAIR', 'vi'), 'Khá');
  assert.equal(formatConditionGrade('used_fair', 'vi'), 'Khá');
  assert.equal(formatConditionGrade('Fair (90%)', 'vi'), 'Khá (90%)');
});

test('formatConditionGrade translates Good and variants to Vietnamese Tốt', () => {
  assert.equal(formatConditionGrade('Good', 'vi'), 'Tốt');
  assert.equal(formatConditionGrade('good', 'vi'), 'Tốt');
  assert.equal(formatConditionGrade('GOOD', 'vi'), 'Tốt');
  assert.equal(formatConditionGrade('USED_GOOD', 'vi'), 'Tốt');
  assert.equal(formatConditionGrade('used_good', 'vi'), 'Tốt');
  assert.equal(formatConditionGrade('Good (95%)', 'vi'), 'Tốt (95%)');
});

test('formatConditionGrade translates Like New and variants to Vietnamese Như mới', () => {
  assert.equal(formatConditionGrade('Like New', 'vi'), 'Như mới');
  assert.equal(formatConditionGrade('like new', 'vi'), 'Như mới');
  assert.equal(formatConditionGrade('LIKE_NEW', 'vi'), 'Như mới');
  assert.equal(formatConditionGrade('LikeNew', 'vi'), 'Như mới');
  assert.equal(formatConditionGrade('Like New (99%)', 'vi'), 'Như mới (99%)');
});

test('formatConditionGrade preserves English when lang is en', () => {
  assert.equal(formatConditionGrade('Fair', 'en'), 'Fair');
  assert.equal(formatConditionGrade('Good', 'en'), 'Good');
  assert.equal(formatConditionGrade('Like New', 'en'), 'Like New');
  assert.equal(formatConditionGrade('USED_FAIR', 'en'), 'Fair');
  assert.equal(formatConditionGrade('USED_GOOD', 'en'), 'Good');
  assert.equal(formatConditionGrade('LIKE_NEW', 'en'), 'Like New');
});

test('formatConditionGrade safely handles empty or already translated strings', () => {
  assert.equal(formatConditionGrade('', 'vi'), '');
  assert.equal(formatConditionGrade(null, 'vi'), '');
  assert.equal(formatConditionGrade(undefined, 'vi'), '');
  assert.equal(formatConditionGrade('Khá', 'vi'), 'Khá');
  assert.equal(formatConditionGrade('Tốt', 'vi'), 'Tốt');
  assert.equal(formatConditionGrade('Như mới', 'vi'), 'Như mới');
});
