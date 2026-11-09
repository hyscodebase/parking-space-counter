# 공개 저장소 작업 안내

현재 프로젝트는 [hyscodebase/parking-space-counter](https://github.com/hyscodebase/parking-space-counter)에서 공개 관리합니다. 처음 업로드하기 위한 비공개 저장소 생성 절차 대신, 기존 저장소를 받아 변경하는 방법을 안내합니다.

## 저장소 받기

```bash
git clone https://github.com/hyscodebase/parking-space-counter.git
cd parking-space-counter
python serve.py
```

GitHub Desktop에서는 **File → Clone repository → URL**에 저장소 주소를 넣습니다. GitHub의 **Code → Download ZIP**으로 받았다면 압축을 풀고 `README.md`와 `dist/`가 있는 폴더에서 실행합니다. ZIP에는 Git 이력이 포함되지 않으므로 지속적으로 수정할 때는 clone을 권장합니다.

## 변경 작업

1. 최신 `main`을 받은 뒤 새 작업 브랜치를 만듭니다.
2. 관련 파일만 수정하고 [README의 테스트](README.md#테스트)를 실행합니다.
3. `git status --short`와 `git diff`로 변경 내용과 공개할 파일을 확인합니다.
4. 검토한 파일만 선택해 커밋하고 작업 브랜치를 push합니다.
5. `main` 대상 Pull Request에 변경 이유와 실행한 검사를 적습니다.

쓰기 권한이 없다면 먼저 GitHub에서 자신의 계정으로 fork하고 그 복제본에서 작업합니다. fork·clone은 원본 앱 코드에 새로운 이용 허락을 부여하지 않습니다. 데이터·라이브러리와 앱 코드의 조건은 [README의 이용 조건](README.md#데이터외부-라이브러리와-이용-조건)을 확인하세요.

이미 이 저장소를 받은 폴더에서 `git init`이나 `gh repo create`를 다시 실행할 필요는 없습니다.

## 파일을 어디에 두나요?

- 웹앱 수정: `dist/`. 이 프로젝트에서는 빌드 결과가 아니라 직접 관리하는 실행 소스도 들어 있습니다.
- 사용·설계·검증 문서: `docs/`
- 자동 검사: `tests/`
- 학습·평가 코드와 출처: `training/`, `tools/`
- 기존 학습·평가 이미지 묶음: `artifacts/`

이미지 ZIP을 푸는 방법은 [재현 안내](docs/reproducibility.md)를 참고하세요. 압축 해제한 이미지·로컬 평가 결과는 기존 `.gitignore`로 제외합니다. 모델·데이터를 바꿀 때는 관련 해시, 출처, 이용 조건, 평가 기록을 함께 검토해야 합니다.

## 공개 전 확인

- 비밀번호, API 키, 토큰, `.env` 파일, 개인 계정 설정을 커밋하지 않습니다.
- 실제 현장의 사진·번호판·얼굴·위치 정보나 팀 내부 문서는 공개 권한을 먼저 확인합니다.
- 출처·라이선스가 확인된 자료만 추가하고 기존 저작권·라이선스 고지를 유지합니다.
- `git diff --cached`로 커밋할 내용을 확인합니다. 무관한 파일까지 일괄 추가하지 않습니다.
- `.gitignore`는 이미 추적된 파일이나 과거 커밋에서 정보를 제거하지 않습니다. 자격 증명이 노출됐다면 먼저 폐기·재발급하고 이력 정리 범위를 별도로 검토합니다.
- 공개 저장소의 파일은 `dist/` 밖에 있어도 열람할 수 있습니다. 웹 호스팅의 공개 디렉터리 설정과 혼동하지 않습니다.
- GitHub 변경과 운영 사이트 배포는 별개로 검토합니다. 자동 배포가 연결돼 있다면 브랜치와 배포 설정을 확인한 뒤 반영합니다.

`package.json`의 `"private": true`는 npm 배포 방지용이므로 공개 GitHub 저장소에서도 유지합니다.

## 공식 참고

- [파일 변경 확인과 업로드](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
- [GitHub Desktop에서 저장소 복제](https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-and-forking-repositories-from-github-desktop)
