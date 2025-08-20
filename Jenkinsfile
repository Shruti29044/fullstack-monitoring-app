pipeline {
  agent any

  options {
    timestamps()
    ansiColor('xterm')
  }

  environment {
    REGISTRY      = 'shruti29044'       // Docker Hub namespace
    SERVER_IMAGE  = "${env.REGISTRY}/monitoring-server"
    WEB_IMAGE     = "${env.REGISTRY}/monitoring-web"
    IMAGE_TAG     = "${env.BUILD_NUMBER}"          // Or use git commit: sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim()
    RELEASE       = 'monitoring-app'
    NAMESPACE     = 'monitoring-app'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        sh 'git rev-parse --short HEAD || true'
      }
    }

    stage('Docker Login') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          sh 'echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin'
        }
      }
    }

    stage('Build & Push Images') {
      steps {
        sh 'docker build -t ${SERVER_IMAGE}:${IMAGE_TAG} ./server'
        sh 'docker push ${SERVER_IMAGE}:${IMAGE_TAG}'

        sh 'docker build -t ${WEB_IMAGE}:${IMAGE_TAG} ./web'
        sh 'docker push ${WEB_IMAGE}:${IMAGE_TAG}'
      }
    }

    stage('Deploy to Kubernetes (Helm)') {
      steps {
        withCredentials([
          file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG'),
          string(credentialsId: 'yelp_fusion_api_key', variable: 'YELP_API_KEY')
        ]) {
          sh 'kubectl --kubeconfig "$KUBECONFIG" get nodes'
          sh 'kubectl --kubeconfig "$KUBECONFIG" create namespace ${NAMESPACE} || true'

          // Upsert Secret with Yelp API key
          sh 'kubectl --kubeconfig "$KUBECONFIG" -n ${NAMESPACE} create secret generic monitoring-app-secrets \
              --from-literal=yelp-api-key="$YELP_API_KEY" \
              --dry-run=client -o yaml | kubectl --kubeconfig "$KUBECONFIG" apply -f -'

          // Helm upgrade/install with image tags
          sh 'helm upgrade --install ${RELEASE} charts/monitoring-app -n ${NAMESPACE} \
              --set image.server.repository=${SERVER_IMAGE} \
              --set image.server.tag=${IMAGE_TAG} \
              --set image.web.repository=${WEB_IMAGE} \
              --set image.web.tag=${IMAGE_TAG} \
              --set ingress.enabled=false'
        }
      }
    }
  }

  post {
    always {
      sh 'docker image prune -f || true'
    }
  }
}


