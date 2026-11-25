import { isPlatformOwner } from './platform-owner';

describe('isPlatformOwner', () => {
  const it_ = { role: 'IT_ADMIN', email: 'owner@example.com' };

  it('is an IT_ADMIN whose email is listed on the server', () => {
    expect(isPlatformOwner(it_, 'owner@example.com')).toBe(true);
    expect(isPlatformOwner({ ...it_, email: 'Owner@Example.com' }, ' other@x.com , OWNER@example.com ')).toBe(true);
  });

  it('the role alone is not enough', () => {
    expect(isPlatformOwner({ ...it_, email: 'someone@school.com' }, 'owner@example.com')).toBe(false);
  });

  it('the email alone is not enough', () => {
    expect(isPlatformOwner({ ...it_, role: 'SUPER_ADMIN' }, 'owner@example.com')).toBe(false);
  });

  it.each([undefined, '', ' , '])('nobody is the owner when the list is %p', (list) => {
    expect(isPlatformOwner(it_, list)).toBe(false);
    expect(isPlatformOwner({ role: 'IT_ADMIN', email: '' }, list)).toBe(false);
  });
});
