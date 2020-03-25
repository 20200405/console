/*
 * This file is part of KubeSphere Console.
 * Copyright (C) 2019 The KubeSphere Console Authors.
 *
 * KubeSphere Console is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * KubeSphere Console is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with KubeSphere Console.  If not, see <https://www.gnu.org/licenses/>.
 */

import React from 'react'
import { toJS } from 'mobx'
import { observer, inject } from 'mobx-react'
import { get, isEmpty } from 'lodash'
import { Loading } from '@pitrix/lego-ui'

import { getDisplayName, joinSelector, getLocalTime } from 'utils'
import { trigger } from 'utils/action'
import { SERVICE_TYPES } from 'utils/constants'
import ServiceStore from 'stores/service'

import DetailPage from 'clusters/containers/Base/Detail'

import routes from './routes'

@inject('rootStore')
@observer
@trigger
export default class ServiceDetail extends React.Component {
  store = new ServiceStore()

  componentDidMount() {
    this.fetchData()
  }

  get module() {
    return 'services'
  }

  get name() {
    return 'Service'
  }

  get listUrl() {
    const { cluster } = this.props.match.params
    return `/clusters/${cluster}/${this.module}`
  }

  fetchData = () => {
    this.store.fetchDetail(this.props.match.params).then(() => {
      const { namespace, selector } = this.store.detail
      const labelSelector = joinSelector(selector)
      if (!isEmpty(labelSelector)) {
        this.store.fetchWorkloads({ namespace, labelSelector })
        this.store.fetchPods({ namespace, labelSelector })
      }
    })
    this.store.fetchEndpoints(this.props.match.params)
  }

  getOperations = () => [
    {
      key: 'edit',
      icon: 'pen',
      text: t('Edit Info'),
      action: 'edit',
      onClick: () =>
        this.trigger('resource.baseinfo.edit', {
          type: t(this.name),
          detail: this.store.detail,
          success: this.fetchData,
        }),
    },
    {
      key: 'editService',
      icon: 'network-router',
      text: t('Edit Service'),
      action: 'edit',
      onClick: () =>
        this.trigger('service.edit', {
          detail: this.store.detail,
        }),
    },
    {
      key: 'editGateway',
      icon: 'ip',
      text: t('Edit Internet Access'),
      action: 'edit',
      show: record => record.type === SERVICE_TYPES.VirtualIP,
      onClick: item =>
        this.trigger('service.gateway.edit', {
          detail: item,
        }),
    },
    {
      key: 'editYaml',
      icon: 'pen',
      text: t('Edit YAML'),
      action: 'edit',
      onClick: () =>
        this.trigger('resource.yaml.edit', {
          detail: this.store.detail,
        }),
    },
    {
      key: 'delete',
      icon: 'trash',
      text: t('Delete'),
      action: 'delete',
      onClick: () =>
        this.trigger('resource.delete', {
          type: t(this.name),
          resource: this.store.detail.name,
        }),
    },
  ]

  getAttrs = () => {
    const detail = toJS(this.store.detail)
    const { cluster, namespace } = this.props.match.params

    if (isEmpty(detail)) {
      return
    }

    let externalIP
    if (detail.type === 'ExternalName') {
      externalIP = detail.externalName
    } else if (detail.specType === 'LoadBalancer') {
      externalIP = detail.loadBalancerIngress
    } else if (detail.externalIPs) {
      externalIP = detail.externalIPs.join(', ')
    }

    const serviceType = get(detail, 'annotations["kubesphere.io/serviceType"]')

    return [
      {
        name: t('Cluster'),
        value: cluster,
      },
      {
        name: t('Project'),
        value: namespace,
      },
      {
        name: t('Type'),
        value: (
          <span>
            {`${
              serviceType
                ? t(`SERVICE_TYPE_${serviceType.toUpperCase()}`)
                : t('Custom Creation')
            }`}
            <span className="text-desc"> ({detail.type})</span>
          </span>
        ),
      },
      {
        name: t('Application'),
        value: detail.application,
      },
      {
        name: t('Virtual IP'),
        value: detail.clusterIP,
      },
      {
        name: t('External IP'),
        value: externalIP,
      },
      {
        name: t('Session Affinity'),
        value: detail.sessionAffinity,
      },
      {
        name: t('Selector'),
        value: joinSelector(detail.selector),
      },
      {
        name: t('DNS'),
        value: this.renderDNS(),
      },
      {
        name: t('Endpoints'),
        value: this.renderEndpoints(),
      },
      {
        name: t('Created Time'),
        value: getLocalTime(detail.createTime).format('YYYY-MM-DD HH:mm:ss'),
      },
      {
        name: t('Updated Time'),
        value: getLocalTime(detail.updateTime).format('YYYY-MM-DD HH:mm:ss'),
      },
      {
        name: t('Creator'),
        value: detail.creator,
      },
    ]
  }

  renderDNS() {
    const { detail: service, workloads, pods } = this.store

    if (
      workloads.isLoading ||
      workloads.type !== 'statefulsets' ||
      pods.isLoading ||
      pods.data.length === 0
    ) {
      return `${service.name}.${service.namespace}`
    }

    return pods.data.map(pod => (
      <p key={pod.uid}>
        {pod.name}.{service.name}.{service.namespace}
      </p>
    ))
  }

  renderEndpoints() {
    const { type } = this.store.detail
    if (type === 'Headless(ExternalName)') {
      return null
    }

    const { isLoading, data } = this.store.endpoints

    if (isLoading) {
      return <Loading size={12} />
    }
    if (data.length === 0) {
      return '-'
    }

    const endpoints = []
    data.forEach(subset => {
      subset.addresses.forEach(addr => {
        subset.ports.forEach(port => {
          if (addr.ip && port.port) {
            endpoints.push(`${addr.ip}:${port.port}`)
          }
        })
      })
    })
    return endpoints.map((end, index) => <p key={index}>{end}</p>)
  }

  render() {
    const stores = { detailStore: this.store }

    if (this.store.isLoading) {
      return <Loading className="ks-page-loading" />
    }

    const sideProps = {
      module: this.module,
      name: getDisplayName(this.store.detail),
      desc: this.store.detail.description,
      operations: this.getOperations(),
      attrs: this.getAttrs(),
      breadcrumbs: [
        {
          label: t(`${this.name}s`),
          url: this.listUrl,
        },
      ],
    }

    return <DetailPage stores={stores} routes={routes} sideProps={sideProps} />
  }
}