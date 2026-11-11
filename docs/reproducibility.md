# 학습 자료 복원과 평가 재현

명령은 저장소 루트에서 실행합니다. 웹앱만 사용할 때는 이 절차가 필요 없습니다.

## 준비

- Python 3.10 이상
- Node.js와 npm. 자동 검사 환경은 Node.js 22입니다.
- 최초 Python·npm 패키지 설치 시 인터넷 연결

가상환경 사용을 권장합니다. 아래는 Linux/macOS 예시입니다. Windows에서는 `.venv\Scripts\activate`로 활성화합니다.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r training/requirements.txt
npm ci --prefix training/eval-runtime
```

`training/requirements.txt`는 이미지 복원용 Pillow 버전을 고정하고, `training/eval-runtime/package-lock.json`은 학습·평가용 JavaScript 패키지를 고정합니다.

## 이미지 자료 복원

학습·평가 이미지들은 개별 파일 대신 `artifacts/`의 ZIP 두 개로 보관합니다.

```bash
python tools/unpack_artifacts.py
python training/restore-fullframe-crops.py training/improvements-data/fullframe-test
python training/restore-fullframe-crops.py training/improvements-data/unseen-view-test
```

첫 명령은 `artifacts/manifest.json`의 SHA256을 확인하고 저장소 안으로 압축을 풉니다. 나머지 명령은 사진 해시·크기와 고정 영역 좌표를 확인해 평가용 RGB crop을 복원합니다.

복원 대상 파일이 이미 있으면 덮어쓸 수 있습니다. 직접 수정한 데이터가 있다면 먼저 별도 위치에 보관하세요. 압축 해제 파일과 아래 로컬 결과 경로는 `.gitignore`에 포함돼 있습니다.

## 재학습

```bash
node training/improvements-data/train-v2.cjs training/improvements-data/dataset-v2 training/retrained-model training/tm-base-mobilenet-v2-035
```

출력을 `training/retrained-model/`에 저장하므로 서비스 중인 `dist/models/parking/` 모델을 덮어쓰지 않습니다. 이 출력 폴더를 다시 사용하면 이전 결과가 덮어써질 수 있습니다.

공식 `@teachablemachine/image@0.8.3`의 Node CPU 학습 경로를 사용합니다. 사진 456장 중 내부 가중치 학습은 386장, 내부 검증은 70장입니다. 외부 검증·시험은 각각 150장입니다. 웹 UI 학습·내보내기 성공을 뜻하지 않습니다.

CPU 속도에 따라 수분 이상 걸립니다. 패키지·체크포인트·데이터·시드가 고정돼 있어도 실행 환경 차이로 재학습 가중치의 바이트가 항상 같다고 보장하지 않습니다.

## 기존 배포 모델 평가

```bash
node training/improvements-data/evaluate-patches.cjs dist/models/parking training/improvements-data/dataset-v2 training/local-evaluation/patches
node training/improvements-data/evaluate-fullframes.cjs dist/models/parking training/local-evaluation/fullframes training/improvements-data/fullframe-test
node training/improvements-data/evaluate-fullframes.cjs dist/models/parking training/local-evaluation/unseen training/improvements-data/unseen-view-test
```

이 명령은 **기존 개별 칸 및 전체 사진의 고정 4칸 평가**를 재현합니다. `tools/evaluate.py`도 A1~A4의 빈자리 수 평가 도구입니다. 가변 1~100칸 차량 수 전체 평가나 [559칸 확대 진단](counting-validation.md)을 재현하는 명령으로 해석하지 마세요.

평가 결과는 `training/local-evaluation/`에 생성됩니다. 같은 출력 경로를 재사용하면 이전 결과가 덮어써질 수 있습니다.

## 파일 구분

- `training/parking-v2-training-source.tm`: 빈자리 228장·사용 중 228장과 설정을 담은 **학습 전 원본 프로젝트**
- `dist/models/parking/{model.json,metadata.json,weights.bin}`: 앱이 사용하는 완성된 추론 모델
- `training/tm-base-mobilenet-v2-035/`: 재학습용 기본 체크포인트
- `training/improvements-data/`: 데이터 manifest, 출처, 학습·평가 코드와 과거 결과

티처블 머신 웹에서 여는 방법은 [별도 안내](teachable-machine.md), 데이터 이용 조건은 [DATA_LICENSE.md](../DATA_LICENSE.md)를 참고하세요.
