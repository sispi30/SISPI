// 페어 옷장 — 캐릭터 반응 엔진 (원본 PHP 옷장의 makeChar 를 그대로 옮긴 것)
// 화면(DOM)을 직접 건드리는 연출(말풍선·흔들림·홍조·땀·먹구름)과 방치 타이머를 맡는다.
// 입은 옷 목록과 표정 이미지는 React 쪽이 갖고, 여기서는 콜백으로 읽고 바꾼다.

export interface CharView {
  cv: HTMLElement | null;       // 캐릭터+옷이 겹쳐진 덩어리 (모션이 걸리는 곳)
  bubble: HTMLElement | null;
  blush: HTMLElement | null;
  sweat: HTMLElement | null;
  cloud: HTMLElement | null;
}

export interface BrainEnv {
  view(cid: 1 | 2): CharView;
  setFace(cid: 1 | 2, n: number): void;
  hasTop(cid: 1 | 2): boolean;   // 상의·하의·원피스 중 하나라도 입었는가
  dg(cid: 1 | 2, key: string): string;
  dgList(cid: 1 | 2, key: string): string[];
  brain(cid: 1 | 2): Brain;
}

const MOTIONS = 'anim-bounce anim-shake anim-jump anim-gloom anim-weak-shake anim-attention anim-heavy anim-heavy-slow anim-peep';
const rm = (el: HTMLElement | null, classes: string) => { if (el) el.classList.remove(...classes.split(' ')); };
const reflow = (el: HTMLElement | null) => { if (el) void el.offsetWidth; };
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

export class Brain {
  isIdle = false;
  isBlush = false;
  isPanic = false;
  private t1: ReturnType<typeof setTimeout> | null = null;
  private t2: ReturnType<typeof setTimeout> | null = null;
  private t3: ReturnType<typeof setTimeout> | null = null;
  nakedT: ReturnType<typeof setTimeout> | null = null;
  private rareT: ReturnType<typeof setTimeout> | null = null;
  private attI: ReturnType<typeof setInterval> | null = null;
  private msgI: ReturnType<typeof setInterval> | null = null;
  private bubT: ReturnType<typeof setTimeout> | null = null;
  private dead = false;

  constructor(private cid: 1 | 2, private env: BrainEnv) {}

  private get v() { return this.env.view(this.cid); }
  private face(n: number) { this.env.setFace(this.cid, n); }
  private dg(key: string) { return this.env.dg(this.cid, key); }
  private list(key: string) { return this.env.dgList(this.cid, key); }
  private get hasTop() { return this.env.hasTop(this.cid); }
  private get other() { return this.env.brain(this.cid === 1 ? 2 : 1); }

  /** 페이지를 떠날 때 — 남은 타이머를 전부 끈다 */
  destroy() {
    this.dead = true;
    this.resetT();
    if (this.bubT) clearTimeout(this.bubT);
  }

  bubble(msg: string, face?: number, dur?: number) {
    const b = this.v.bubble;
    if (!b || this.dead) return;
    if (this.bubT) clearTimeout(this.bubT);
    rm(b, 'anim-pop bvis');
    b.style.transform = ''; b.style.opacity = '';
    b.textContent = msg;
    const stay = dur || 2500;
    if (!this.isIdle && !this.isBlush) this.face(face || (Math.random() < 0.5 ? 2 : 3));
    else if (face) this.face(face);
    if (this.isIdle || this.isBlush) {
      b.style.transform = 'translateX(-50%)';
      requestAnimationFrame(() => b.classList.add('bvis'));
      this.bubT = setTimeout(() => b.classList.remove('bvis'), stay);
    } else {
      reflow(b);
      b.classList.add('anim-pop', 'bvis');
      this.bubT = setTimeout(() => {
        b.classList.remove('bvis');
        setTimeout(() => {
          b.classList.remove('anim-pop');
          if (!this.isIdle && !this.isBlush && !this.dead) this.face(1);
        }, 400);
      }, stay);
    }
  }

  anim(cls: string) {
    const cv = this.v.cv;
    if (!cv) return;
    rm(cv, MOTIONS); reflow(cv);
    requestAnimationFrame(() => cv.classList.add(cls));
  }

  /** 가끔 통통 튀며 눈길을 끈다 */
  private attn() {
    const cv = this.v.cv;
    if (!cv || this.isIdle || this.isBlush || this.isPanic || document.querySelector('.closet-dragging')) return;
    rm(cv, 'anim-bounce anim-shake anim-jump anim-heavy'); reflow(cv);
    cv.classList.add('anim-attention');
    setTimeout(() => cv.classList.remove('anim-attention'), 600);
  }

  sweat() {
    const s = this.v.sweat;
    if (!s) return;
    s.innerHTML = '';
    [{ l: '26.7%', d: '0s' }, { l: '66.7%', d: '.1s' }, { l: '73.3%', d: '.3s' }].forEach(o => {
      const el = document.createElement('div');
      el.className = 'sweat-drop';
      el.style.left = o.l;
      el.style.animation = `closetSweat .6s ${o.d} linear`;
      s.appendChild(el);
    });
    setTimeout(() => { s.innerHTML = ''; }, 1000);
  }

  clouds() {
    const c = this.v.cloud;
    if (!c) return;
    c.innerHTML = '';
    [{ l: '20%', t: '14.2%', w: '30%', h: '5%', d: '0s' }, { l: '40%', t: '10.8%', w: '36.7%', h: '5.8%', d: '.5s' }].forEach(o => {
      const el = document.createElement('div');
      el.className = 'dark-cloud';
      Object.assign(el.style, { left: o.l, top: o.t, width: o.w, height: o.h, animationDelay: o.d });
      c.appendChild(el);
    });
  }

  private clearClouds() { if (this.v.cloud) this.v.cloud.innerHTML = ''; }
  private blushOn(on: boolean) { this.v.blush?.classList.toggle('active-blush', on); }

  resetT() {
    [this.t1, this.t2, this.t3, this.nakedT, this.rareT].forEach(t => { if (t) clearTimeout(t); });
    if (this.msgI) clearInterval(this.msgI);
    if (this.attI) clearInterval(this.attI);
  }

  startIdle() {
    this.resetT();
    this.t1 = setTimeout(() => this.s1(), 30000);
    if (this.hasTop && !this.isBlush && !this.isIdle && !this.isPanic) {
      if (this.attI) clearInterval(this.attI);
      this.attI = setInterval(() => this.attn(), 3000);
    }
  }

  private s1() {
    if (this.msgI) clearInterval(this.msgI);
    if (this.attI) clearInterval(this.attI);
    const o = this.other;
    const pb = !o.isIdle && !o.isPanic && !o.isBlush;
    if (!this.hasTop) {
      this.face(2); this.bubble(this.dg('boast_success'), 2);
      setTimeout(() => { if (!this.hasTop) this.face(4); }, 3000);
    } else if (pb) {
      this.face(1); this.bubble(this.dg('wait_partner'), 1);
    } else {
      this.face(2); this.motion('anim-peep', 2000); this.bubble(this.dg('idle_stage1'), 2);
    }
    this.t2 = setTimeout(() => this.s2(), 15000);
  }

  private s2() {
    if (this.msgI) clearInterval(this.msgI);
    if (this.attI) clearInterval(this.attI);
    this.face(4);
    if (!this.hasTop) this.bubble(this.dg('idle_stage2'), 4);
    else { this.motion('anim-heavy-slow', 2500); this.bubble(this.dg('idle_stage2'), 4); }
    this.t3 = setTimeout(() => { this.hasTop ? this.stdIdle() : this.nakedIdle(); }, 15000);
  }

  private motion(cls: string, dur: number) {
    const cv = this.v.cv;
    if (!cv) return;
    rm(cv, 'anim-attention anim-weak-shake anim-shake anim-bounce anim-peep anim-heavy-slow anim-heavy'); reflow(cv);
    cv.classList.add(cls);
    setTimeout(() => {
      cv.classList.remove(cls);
      if (!this.hasTop && !this.isIdle) setTimeout(() => cv.classList.add('anim-weak-shake'), 50);
    }, dur);
  }

  startBlush() {
    this.resetT();
    this.isBlush = true; this.isPanic = false;
    this.face(4); this.blushOn(true);
    const cv = this.v.cv;
    rm(cv, 'anim-heavy anim-bounce anim-shake anim-jump anim-gloom anim-heavy-slow'); reflow(cv);
    cv?.classList.add('anim-weak-shake');
    this.bubble(this.dg('blush_msg'), 4);
    this.msgI = setInterval(() => this.bubble(this.dg('blush_msg'), 4), 15000);
  }

  private stdIdle() {
    this.resetT();
    this.isIdle = true; this.isBlush = false; this.isPanic = false;
    const o = this.other;
    const pb = !o.isIdle && !o.isPanic && !o.isBlush;
    if (pb) this.face(1);
    else { this.face(4); this.anim('anim-gloom'); this.clouds(); }
    this.spkIdle();
    this.msgI = setInterval(() => this.spkIdle(), 15000);
  }

  private nakedIdle() {
    this.resetT();
    this.isIdle = true; this.isBlush = false; this.isPanic = false;
    this.face(4); this.clouds(); this.blushOn(true);
    this.v.cv?.classList.add('anim-weak-shake');
    this.spkMix();
    this.msgI = setInterval(() => this.spkMix(), 15000);
  }

  private spkIdle() {
    const list = this.list('idle_list');
    if (Math.random() < 0.1) {
      if (this.msgI) clearInterval(this.msgI);
      this.v.cv?.classList.remove('anim-gloom');
      this.face(5); this.bubble(this.dg('rare_msg'), 5);
      this.rareT = setTimeout(() => {
        if (this.isIdle) {
          this.v.cv?.classList.add('anim-gloom'); this.face(4); this.spkIdle();
          this.msgI = setInterval(() => this.spkIdle(), 15000);
        }
      }, 5000);
    } else this.bubble(pick(list), 4);
  }

  private spkMix() {
    const pool = this.list('idle_list').concat([this.dg('blush_msg'), this.dg('blush_msg')]);
    if (Math.random() < 0.1) {
      if (this.msgI) clearInterval(this.msgI);
      this.v.cv?.classList.remove('anim-weak-shake'); this.blushOn(false);
      this.face(5); this.bubble(this.dg('rare_msg'), 5);
      this.rareT = setTimeout(() => {
        if (!this.hasTop) {
          this.v.cv?.classList.add('anim-weak-shake'); this.blushOn(true);
          this.bubble(pick(pool), 4);
          this.msgI = setInterval(() => this.spkMix(), 15000);
        }
      }, 5000);
    } else this.bubble(pick(pool), 4);
  }

  /** 캐릭터를 눌렀을 때 */
  click() {
    this.resetT(); this.clearClouds();
    this.v.cv?.classList.remove('anim-gloom');
    if (this.isBlush) {
      this.blushOn(true); this.face(2); this.anim('anim-weak-shake'); this.bubble(this.dg('blush_msg'), 2);
      setTimeout(() => { if (this.isBlush) { this.face(4); this.startBlush(); } }, 2000);
    } else if (this.isPanic) {
      this.face(2); this.anim('anim-shake'); this.bubble(this.dg('panic_click'), 2);
      this.nakedT = setTimeout(() => this.startBlush(), 2000);
    } else if (this.isIdle) {
      this.interact(false);
    } else if (this.hasTop) {
      this.anim('anim-bounce'); this.bubble(pick(this.list('click_list'))); this.startIdle();
    }
  }

  /** 옷이 바뀐 직후 — 상태를 정리하고 상황에 맞는 반응을 한다 */
  interact(isInit: boolean, skipDlg?: boolean) {
    const wi = this.isIdle, wb = this.isBlush, wp = this.isPanic;
    this.resetT(); this.clearClouds(); this.blushOn(false);
    rm(this.v.cv, 'anim-gloom anim-weak-shake');
    this.isBlush = false; this.isIdle = false; this.isPanic = false;
    if (this.hasTop) {
      if (!isInit && !skipDlg) {
        if (wi) { this.face(3); this.anim('anim-bounce'); this.bubble(this.dg('return_msg'), 3); }
        else if (wb) { this.face(3); this.anim('anim-bounce'); this.bubble(this.dg('thanks_msg'), 3); }
        else if (wp) { this.face(2); this.anim('anim-bounce'); this.bubble(this.dg('panic_exit'), 2); }
        else { this.anim('anim-bounce'); this.bubble(pick(this.list('dress_list'))); }
      } else if (!isInit) this.face(1);
      this.startIdle();
    } else {
      if (!isInit) {
        if (wi || wb) { this.face(2); this.anim('anim-bounce'); this.bubble(this.dg('return_panic'), 2); }
        else if (wp) { this.face(2); this.anim('anim-bounce'); this.bubble(this.dg('panic_click'), 2); }
        else this.anim('anim-bounce');
      } else this.face(1);
      this.startIdle();
      this.nakedT = setTimeout(() => this.startBlush(), 3000);
    }
  }

  /** 입은 게 없는데 「전부 벗기!」 */
  nothingToTakeOff() {
    this.resetT();
    this.anim('anim-shake'); this.sweat(); this.bubble(this.dg('nothing'), 2); this.startIdle();
    this.nakedT = setTimeout(() => this.startBlush(), 3000);
  }

  /** 「전부 벗기!」 — 옷이 날아간 뒤 afterOff 로 실제 제거를 맡긴다 */
  panicOff(afterOff: () => void) {
    this.resetT(); this.clearClouds(); this.blushOn(false);
    rm(this.v.cv, 'anim-gloom anim-weak-shake');
    this.isIdle = false; this.isBlush = false; this.isPanic = true;
    this.anim('anim-shake'); this.sweat(); this.bubble(this.dg('panic_enter'), 2);
    setTimeout(() => {
      afterOff();
      this.startIdle();
      this.nakedT = setTimeout(() => this.startBlush(), 3000);
    }, 500);
  }

  /** 「다시 입히기」 — 기본 코디로 갈아입은 뒤 */
  afterRestore() {
    this.resetT(); this.clearClouds(); this.blushOn(false);
    rm(this.v.cv, 'anim-gloom anim-weak-shake anim-heavy anim-heavy-slow');
    this.isIdle = false; this.isBlush = false; this.isPanic = false;
  }

  /** 악세사리를 너무 많이 걸쳤을 때 */
  tooMany() {
    this.anim('anim-heavy'); this.bubble(this.dg('too_many'), 2); this.startIdle();
  }

  /** 입장 */
  init() {
    this.face(2); this.anim('anim-jump'); this.bubble(this.dg('welcome'), 2); this.interact(true);
  }
}
