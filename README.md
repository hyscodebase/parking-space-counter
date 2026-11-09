# 차량 수 확인 · 주차칸별 AI 집계

**문제해결과인공지능 · 이다은 · 허서연 · 윤태현 · 홍유석**

주차장 사진에서 사람이 지정한 주차칸을 기존 Teachable Machine 모델로 `빈자리 / 사용 중`으로 분류하고, **사용 중인 칸의 수를 차량 수로 합산**하는 웹 시제품입니다. 주차칸은 1~100개 지정할 수 있습니다.

[웹 데모](https://stunning-khapse-d705ce.netlify.app/) · [공개 GitHub 저장소](https://github.com/hyscodebase/parking-space-counter) · [문서 목록](docs/README.md)

> 지정한 주차칸 안의 차량만 셉니다. 사진 전체의 차량이나 주차칸을 자동 탐지하지 않으며, 한 칸에 차량 한 대가 있다는 전제가 필요합니다.

## 빠른 실행

Python 3.10 이상이 필요합니다. 저장소를 받은 뒤 루트에서 실행합니다.

```bash
git clone https://github.com/hyscodebase/parking-space-counter.git
cd parking-space-counter
python serve.py
```

브라우저에서 http://localhost:8000 을 엽니다. 환경에 따라 `python` 대신 `python3`를 사용하세요.

- 웹앱 실행에는 npm 설치, 빌드, 데이터 압축 해제, AI API 키가 필요 없습니다.
- 실행 코드·기본 모델·브라우저 라이브러리는 `dist/`에 포함돼 있습니다.
- `dist/index.html`을 파일로 직접 열면 ES 모듈 제한으로 동작하지 않습니다.
- Linux에서는 `bash start-linux.sh 8000`으로도 실행할 수 있습니다.

## 사용 순서

1. **사진 촬영** 또는 **사진 선택**으로 주차장 사진을 불러옵니다. 먼저 **예제로 체험**을 눌러 볼 수도 있습니다.
2. 처음 사용하는 주차장은 주차칸 영역을 추가하고, 저장한 주차장은 프로필을 불러옵니다.
3. 각 영역이 서로 다른 주차칸 하나에 맞고 현재 사진과 정렬돼 있는지 확인합니다.
4. 분석 결과에서 확인된 차량 수와 **확인 필요** 칸을 함께 확인합니다.

사용 중 7칸·빈자리 2칸·확인 필요 1칸이면 `확인된 차량 7대`, `7~8대`로 안내합니다. 확인 필요 칸을 임의로 빈자리나 차량으로 바꾸지 않습니다. 모델은 확신이 높아도 틀릴 수 있으므로 표시 범위가 실제 수량을 보장하지는 않습니다.

같은 카메라 위치의 사진은 영역을 재사용할 수 있습니다. 위치·각도·줌·사진의 잘린 범위가 달라지면 다시 맞춰야 합니다. 통로나 영역 밖 차량, 한 차량이 여러 칸을 차지하는 경우, 한 칸에 여러 차량이 있는 경우는 단순 합산의 범위 밖입니다.

## 주요 기능

- JPG·PNG·WebP 사진 선택과 모바일 촬영 입력, 최대 20 MB
- 주차칸 1~100개 추가·수정·삭제, 중복 영역 차단과 큰 겹침 경고
- 주차장 프로필 및 영역 JSON 저장·불러오기
- 기본 모델 또는 직접 학습한 이진 Teachable Machine 모델 연결
- 224×224 주차칸 자르기, 브라우저 내 추론과 차량 수 합산
- 단색·암전·과노출 영역의 추론 생략, 낮은 확률·동률은 확인 필요 처리
- 분석 진행·취소·재시도, 분석 JSON 내보내기
- 반응형 화면

모바일 촬영 화면과 지원 형식은 기기·브라우저에 따라 다르며, 실시간 카메라 스트리밍은 제공하지 않습니다. iPhone·Android 실기기의 촬영·메모리·분석 시간은 별도 검증이 필요합니다.

### 사진과 모델 처리

사진과 로컬 모델 파일은 앱 서버에 업로드하지 않습니다. 기본 모델은 현재 사이트에서 읽고, 외부 모델 URL을 지정하면 해당 서버에 모델 파일을 요청합니다. 프로필은 현재 브라우저에 저장됩니다.

공개 예제는 PKLot 실제 사진과 주석이 있는 28개 주차칸의 위치를 불러와 **실제 모델로 추론**합니다. 정답 수량이나 고정 확률을 결과로 대신하지 않습니다.

## 저장소 구조

| 경로 | 내용 |
| --- | --- |
| `dist/` | 웹앱 원본 JS·HTML·CSS, 추론용 모델, 예제, 브라우저 라이브러리. 별도 빌드 없이 서비스하는 디렉터리 |
| `docs/` | 집계 방식, 평가 한계, 사용·배포·재현 안내와 과거 검증 기록 |
| `tests/` | JavaScript 및 Python 자동 검사 |
| `tools/` | 데이터 준비, 고정 4칸 평가, 압축 자료 복원 도구 |
| `training/` | 학습 전 Teachable Machine 프로젝트, 재학습·평가 코드, 출처 기록 |
| `artifacts/` | 학습·평가 이미지 ZIP 두 개와 SHA256 목록 |
| `deployment/` | Linux Nginx 설정 예제 |
| `serve.py`, `start-linux.sh` | 로컬 실행 도구 |

`dist/`는 이 프로젝트에서 직접 관리하는 실행 소스이므로 삭제하거나 일반적인 빌드 산출물로 취급하지 않습니다. 기존 파일 배치와 모델 경로를 유지합니다.

## 모델과 평가 범위

기본 모델은 공식 `@teachablemachine/image@0.8.3` 라이브러리를 Node CPU에서 학습한 MobileNetV2 0.35 기반 v2 모델입니다. 웹 학습 화면이 응답하지 않아 실행 환경을 바꿨으며, 웹 UI에서 학습·내보내기에 성공한 것으로 표현하지 않습니다.

PKLot UFPR04 주간 사진 456장(빈자리 228장·사용 중 228장)을 학습 프로젝트에 넣었습니다. 내부 가중치 학습 386장·내부 검증 70장이며, 외부 검증 150장과 시험 150장은 날짜 단위로 분리했습니다. 현재 차량 수 합산 기능은 기존 v2 가중치를 그대로 사용합니다.

| 기존 v2 평가 범위 | 기록된 결과 |
| --- | --- |
| 개별 칸 외부 검증 150장 | 149/150 정답 |
| 개별 칸 시험 150장 | 150/150 정답 |
| 실제 전체 사진 30장의 고정 4칸 | 120/120칸 정답, 빈자리 수 30/30 일치 |
| 미학습 카메라·주차장 10장의 고정 4칸 | 37/40칸 정답, 빈자리 수 8/10 일치 |

별도의 확대 진단에서는 이미 관찰한 UFPR04 사진 20장의 주석 칸 559개 중 551개(98.57%)를 맞혔지만, **확인 필요 없이 차량 수까지 정확한 사진은 13/20장(65%)**이었습니다. 빈 칸을 차량으로 판단한 오류 3칸과 확인 필요 5칸이 있었습니다.

위 결과는 새로운 독립 최종 시험이나 다른 현장의 정확도 보장이 아닙니다. 100칸 지정 기능이 100칸의 정확도를 입증하지 않으며, 다른 현장·야간·새 카메라는 별도 검증이 필요합니다. 모델 카드와 원본 수치는 [모델 자료](dist/models/parking/), 상세 해석은 [진단 보고서](docs/counting-validation.md)에서 확인하세요.

## 테스트

JavaScript 검사는 Node.js가 필요합니다. GitHub Actions는 Node.js 22와 Python 3.12로 실행합니다.

```bash
npm test
python -m pip install -r tools/requirements.txt
python -m unittest discover -s tests -p 'test_*.py' -v
```

현재 자동 검사 구성은 JavaScript 50개·Python 14개입니다. 계산과 입력 검증을 확인하며 모델 정확도를 대신하지 않습니다. [브라우저 확인 기록](docs/counting-browser-qa.md)은 2026-11-03의 기록으로, 실제 휴대폰 시험과 구분합니다.

`package.json`의 `"private": true`는 npm 패키지의 실수 공개를 막는 설정입니다. GitHub 저장소의 공개 상태와는 별개입니다.

## 학습·배포·기여 안내

- [학습 자료 복원과 재현](docs/reproducibility.md): 이미지 ZIP 복원, 재학습, 고정 4칸 평가 명령
- [티처블 머신에서 열기](docs/teachable-machine.md): `training/parking-v2-training-source.tm`을 **Open project from file → Train Model → 미리보기** 순서로 사용
- [Netlify 배포 안내](docs/netlify-deployment.md) · [Linux 배포 안내](docs/linux.md)
- [저장소 작업 안내](GITHUB_UPLOAD.md): clone·fork·변경 검토와 공개 전 확인 사항

`.tm` 파일은 사진 456장과 설정을 담은 **학습 전 원본 프로젝트**입니다. 완성된 추론용 모델은 `dist/models/parking/{model.json,metadata.json,weights.bin}`입니다.

정적 웹 호스팅에는 `dist/`만 지정합니다. Netlify의 `netlify.toml`도 이 디렉터리를 사용하며 별도 빌드 명령이나 환경 변수는 필요 없습니다. 저장소 전체를 웹 루트로 서비스하지 마세요. 단, 웹 배포 범위와 별개로 공개 GitHub 저장소에 커밋된 파일은 누구나 볼 수 있습니다.

## 데이터·외부 라이브러리와 이용 조건

- PKLot: Almeida et al., “PKLot – A robust dataset for parking lot classification”, *Expert Systems with Applications* 42(11), 4937–4949, 2015. 데이터 CC BY 4.0. [공식 출처](https://web.inf.ufpr.br/vri/databases/parking-lot-database/)
- 사진·라벨·변환 출처: [DATA_LICENSE.md](DATA_LICENSE.md)
- 외부 코드와 라이선스: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [licenses/](licenses/)

**저장소 공개는 새 오픈소스 라이선스 부여를 의미하지 않습니다.** 팀의 원본 앱 코드에는 별도 오픈소스 라이선스를 지정하지 않았으며, 데이터·외부 라이브러리의 라이선스를 앱 코드 전체에 적용하지 않습니다.
