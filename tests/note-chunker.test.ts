import { describe, it, expect } from 'vitest';
import { chunkNote, extractSectionContent, estimateTokens } from '../src/core/application/services/note-chunker';

const STANDARD_NOTE = `---
id: 202603272033
created: '2026-03-27 20:33'
type: permanent
status: refined
tags:
  - concept/social-psychology
---

# 202603272033 정보 폭포와 합리적 모방의 역설

## 핵심 아이디어

- 정보 폭포는 순차적 의사결정 상황에서 개인이 사적 신호보다 공적 정보를 우선할 때 발생한다.
- 폭포가 시작되면 후속 행위자는 자신의 사적 정보를 공개적 행동에 반영하지 않는다.
- 정보 폭포는 사회적 동조와 외형상 유사하지만 질적으로 구별된다.

## 상세 설명

#### 정보 폭포의 정의와 형성 메커니즘

정보 폭포(information cascade)란 순차적 의사결정 상황에서 후행 행위자가 자신의 사적 신호를 무시하고 선행자의 관찰 가능한 행동에 기반하여 동일한 선택을 하는 현상을 말한다. Bikhchandani, Hirshleifer, Welch(1992)의 모델에서 정보 폭포는 다음 조건에서 형성된다. 의사결정자들이 순차적으로 선택하며, 각자는 사적 신호를 보유하지만, 선행자의 선택 이유는 알 수 없고 행동 결과만 관찰할 수 있다. 첫 두 명이 우연히 같은 방향으로 선택하면, 세 번째 행위자는 자신의 사적 신호가 반대 방향이더라도 다수를 따른다.

#### 합리적 모방의 역설

정보 폭포의 핵심 역설은 각 개인이 합리적으로 행동하는데도 집단은 비합리적 결과에 수렴할 수 있다는 구조에 있다. 각 행위자의 베이지안 업데이트는 주어진 정보 집합 내에서 최적이지만, 사적 정보를 행동에 반영하지 않음으로써 공공재적 성격의 정보를 집단에 기여하지 않는다. 이것은 정보의 외부성(informational externality) 문제이며, 개인은 자기 이익을 극대화하지만 집단의 정보 풀이 빈곤해지는 사회적 딜레마가 발생한다.

#### 디지털 환경에서의 가속과 변형

현대 SNS 환경은 정보 폭포의 고전적 조건을 극단화한다. 좋아요, 공유, 팔로워 수는 선행자의 행동을 실시간으로 가시화하되 이유는 감추며, 알고리즘 추천은 초기 인기 콘텐츠를 노출 우선순위에 배치하여 폭포의 시작 임계값을 낮춘다. 동시에 익명성과 약한 유대는 규범적 동조 압력을 감소시키므로, 디지털 폭포는 순수하게 정보적 경로를 통해 작동하는 경향이 더 강하다.

## 연결된 생각

- 관련 개념: 군집 행동, 합리적 무지, 경로 의존성
- 상위 개념: 사회적 영향, 집단 의사결정

## 적용 예시

#### 일상/개인 실천

- 온라인 쇼핑에서 리뷰 수와 별점이 높은 제품을 선택할 때 폭포 여부를 자문하는 습관이 방어가 된다.

#### 조직/협업 사례

- 투자 위원회에서 선임 파트너가 먼저 의견을 개진하면 정보 폭포가 형성된다.

#### 사회/시스템 관점

- 금융 시장의 버블과 패닉은 정보 폭포의 대규모 발현이다.

## 참고 자료

- Bikhchandani et al., A Theory of Fads, 1992.
- 선스타인, 우리는 왜 극단에 끌리는가, 2011.

### 🔗 연결된 노트

- [[202603271315 사회적 인식론]] • 상위 맥락
- [[202602141538 집단 극화와 위험 이동]] • 상위 맥락

### 🏷️ 관련 태그

#정보폭포 #합리적모방 #군집행동`;

describe('chunkNote', () => {
  it('should split standard permanent note into expected chunks', () => {
    const chunks = chunkNote(STANDARD_NOTE, '정보 폭포와 합리적 모방의 역설');

    // Should have: 핵심 아이디어 (1) + 상세 설명 #### (3) + 적용 예시 (1) = 5
    expect(chunks.length).toBe(5);

    // First chunk: 핵심 아이디어
    expect(chunks[0].heading).toBe('핵심 아이디어');
    expect(chunks[0].headingLevel).toBe(2);

    // 상세 설명 sub-chunks
    expect(chunks[1].heading).toBe('상세 설명 > 정보 폭포의 정의와 형성 메커니즘');
    expect(chunks[1].headingLevel).toBe(4);
    expect(chunks[2].heading).toBe('상세 설명 > 합리적 모방의 역설');
    expect(chunks[3].heading).toBe('상세 설명 > 디지털 환경에서의 가속과 변형');

    // Last chunk: 적용 예시
    expect(chunks[4].heading).toBe('적용 예시');
    expect(chunks[4].headingLevel).toBe(2);
  });

  it('should skip metadata sections', () => {
    const chunks = chunkNote(STANDARD_NOTE, '테스트 노트');
    const headings = chunks.map((c) => c.heading);

    expect(headings).not.toContain('연결된 생각');
    expect(headings).not.toContain('참고 자료');
    // 🔗 연결된 노트 and 🏷️ 관련 태그 should also be skipped
    expect(headings.every((h) => !h.includes('연결된 노트'))).toBe(true);
    expect(headings.every((h) => !h.includes('관련 태그'))).toBe(true);
  });

  it('should prepend note title to each chunk content', () => {
    const chunks = chunkNote(STANDARD_NOTE, '테스트 제목');

    for (const chunk of chunks) {
      expect(chunk.content.startsWith('# 테스트 제목\n\n')).toBe(true);
    }
  });

  it('should handle non-standard notes (no H2) as single chunk', () => {
    const simpleNote = `---
id: 1234
type: permanent
---

# Simple Note

This is a simple note without H2 headings.
It has some content but no structure.`;

    const chunks = chunkNote(simpleNote, 'Simple Note');
    expect(chunks.length).toBe(1);
    expect(chunks[0].heading).toBe('Simple Note');
    expect(chunks[0].headingLevel).toBe(1);
  });

  it('should handle notes with only metadata sections (return empty)', () => {
    const metaOnly = `---
type: permanent
---

# Meta Note

## 연결된 생각

- keyword1

## 참고 자료

- reference 1`;

    const chunks = chunkNote(metaOnly, 'Meta Note');
    expect(chunks.length).toBe(0);
  });

  it('should assign sequential sectionIndex', () => {
    const chunks = chunkNote(STANDARD_NOTE, 'Test');
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].sectionIndex).toBe(i);
    }
  });
});

describe('extractSectionContent', () => {
  it('should extract H2 section content', () => {
    const content = extractSectionContent(STANDARD_NOTE, '핵심 아이디어');
    expect(content).toBeTruthy();
    expect(content).toContain('정보 폭포는');
  });

  it('should extract #### sub-section via "상세 설명 > 소제목" format', () => {
    const content = extractSectionContent(
      STANDARD_NOTE,
      '상세 설명 > 합리적 모방의 역설'
    );
    expect(content).toBeTruthy();
    expect(content).toContain('핵심 역설');
  });

  it('should return null for non-existent section', () => {
    const content = extractSectionContent(STANDARD_NOTE, '존재하지 않는 섹션');
    expect(content).toBeNull();
  });
});

describe('estimateTokens', () => {
  it('should estimate Korean text tokens', () => {
    const korean = '한국어 텍스트 테스트입니다';
    const tokens = estimateTokens(korean);
    expect(tokens).toBeGreaterThan(0);
  });

  it('should estimate English text tokens', () => {
    const english = 'This is an English text for token estimation';
    const tokens = estimateTokens(english);
    expect(tokens).toBeGreaterThan(0);
  });
});
