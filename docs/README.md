# 문서 안내

처음 실행한다면 [프로젝트 README](../README.md)의 빠른 실행을 먼저 확인하세요.

## 사용과 설계

- [집계 방식과 한계](counting-design.md): 주차칸별 분류, 수량 범위, 전제
- [모델 연결](model-integration.md): 기본 모델과 외부·로컬 모델
- [티처블 머신에서 열기](teachable-machine.md): 학습 전 `.tm` 프로젝트 사용

## 데이터·학습·평가

- [자료 복원과 재현](reproducibility.md): 이 저장소의 경로를 기준으로 한 실행 명령
- [새 데이터 준비](data-training.md): 날짜·촬영 구간 분리와 고정 4칸 평가 도구
- [v2 데이터 구성](../training/improvements-data/DATA_README.md)
- [559칸 확대 진단](counting-validation.md) · [원본 수치](counting-validation.json)
- [모델 카드](../dist/models/parking/MODEL_CARD.md)
- [데이터 출처·라이선스](../DATA_LICENSE.md) · [외부 라이브러리 고지](../THIRD_PARTY_NOTICES.md)

`training/improvements-data/README.md`는 사용한 **외부 PKLot 미러의 설명을 보존한 파일**입니다. 그 문서의 데이터셋 구조와 이용 조건을 이 웹앱 전체의 구조·라이선스로 해석하지 않습니다.

## 실행·배포·저장소 관리

- [Linux 실행과 Nginx 예제](linux.md)
- [Netlify 정적 배포](netlify-deployment.md)
- [공개 저장소 작업 안내](../GITHUB_UPLOAD.md)

## 과거 검증 기록

아래 기록은 적힌 날짜와 환경에서 수행한 결과입니다. 현재 환경의 새 검증이나 실제 휴대폰 시험을 대신하지 않습니다.

- [차량 수 합산 화면 확인](counting-browser-qa.md): 2026-11-03, 1~100칸 UI
- [이전 4칸 화면 회귀 확인](browser-regression.md): 2026-10-27
- [Netlify 공개 사이트 확인](netlify-deployment.md#2026-11-04-접속-확인-기록): 2026-11-04
