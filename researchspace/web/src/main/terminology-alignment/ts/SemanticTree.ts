/*
 * Copyright (C) 2015-2017, © Trustees of the British Museum
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, you can receive a copy
 * of the GNU Lesser General Public License from http://www.gnu.org/
 */

import {
  Component, DOM as D, ReactElement, createElement, createFactory,
} from 'react';
import { List } from 'immutable';
import * as React from 'react';

import * as classnames from 'classnames';

import { Cancellation } from 'platform/api/async/Cancellation';

import { SparqlUtil } from 'platform/api/sparql';

import Spinner from 'platform/components/ui/spinner/Spinner';
import ErrorNotification from 'platform/components/ui/notification/ErrorNotification';

import { KeyedForest, OffsetPath } from 'platform/components/semantic/lazy-tree/KeyedForest';
import { TreeSelection } from 'platform/components/semantic/lazy-tree/TreeSelection';

import {
  Node,
  NodeTreeSelector,
  NodeTreeProps,
  EmptyForest,
  queryMoreChildren,
  RootsChange,
  mergeRemovingDuplicates,
  nodesFromQueryResult
} from 'platform/components/semantic/lazy-tree/NodeModel';


//import { SubtreeSelection } from './LazyTreeSelector';
import { SinglePartialSubtree, SelectionMode } from 'platform/components/semantic/lazy-tree/SelectionMode';

import * as styles from 'platform/components/semantic/lazy-tree/SemanticTreeInput.scss';



export interface Props extends React.Props<SemanticTree> {
  /**
   * Optional custom class for the tree.
   */
  className?: string;

  /**
   * Tree roots query with no input and [?item, ?label, ?hasChildren] output variables.
   */
  rootsQuery: string;
  /**
   * Children query with [?parent] input and [?item, ?label, ?hasChildren] output variables.
   */
  childrenQuery: string;
  /**
   * Parent nodes query with [?item] inputs through VALUES(...) clause
   * and [?item, ?parent, ?parentLabel] outputs.
   */
  parentsQuery: string;

  /** Callback invoked when tree selection changes. */
  onSelectionChanged: (selection: TreeSelection<Node>) => void;

  requestMoreChildren: (node: Node) => Kefir.Property<List<Node>>;

  getForest?: (forest: KeyedForest<Node>) => void;

  renderItem?: (node: Node) => React.ReactElement<any>;

  selection?: TreeSelection<Node>;

  selectionMode?: SelectionMode<Node>,

  hideCheckboxes?: boolean;

}

interface State {
  forest?: KeyedForest<Node>;

  loadError?: any;
  rootsQuery?: SparqlJs.SelectQuery;
  childrenQuery?: SparqlJs.SelectQuery;
  parentsQuery?: SparqlJs.SelectQuery;

  confirmedSelection?: TreeSelection<Node>;
}

export class SemanticTree extends Component<Props, State> {
  private cancellation = new Cancellation();

  constructor(props: Props) {
    super(props);
    this.state = {
      forest: EmptyForest.setRoot({
        iri: undefined,
        children: List<Node>(),
        hasMoreItems: true,
      }),
      confirmedSelection: TreeSelection.empty(EmptyForest.keyOf),
    };
  }

  componentDidMount() {
    this.load(this.props);
  }

  componentWillReceiveProps(nextProps: Props) {
    this.load(nextProps);
  }

  private load(nextProps: Props) {
    const emptyForest = () => EmptyForest.setRoot({
      iri: undefined,
      children: List<Node>(),
      hasMoreItems: true,
    });

    this.setState({
      //new: add 'forest' too, in order to update trees when roots queries change
      forest: (nextProps.rootsQuery === this.props.rootsQuery) ?
        (this.state.forest ? this.state.forest : emptyForest())
        :
        emptyForest(),
      rootsQuery: SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(nextProps.rootsQuery),
      childrenQuery: SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(nextProps.childrenQuery),
      parentsQuery: SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(nextProps.parentsQuery),
    });
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  render() {
    const queriesLoaded =
      this.state.rootsQuery &&
      this.state.childrenQuery &&
      this.state.parentsQuery;

    if (this.state.loadError) {
      return D.div({ className: classnames(styles.holder, this.props.className) },
        createElement(ErrorNotification, { errorMessage: this.state.loadError })
      );
    } else if (queriesLoaded) {
      return D.div(
        { className: classnames(styles.holder, this.props.className) },
        D.div(
          { className: styles.tree },
          this.renderTree(this.props.selection)
        )
      );
    } else {
      return D.div({ className: styles.holder }, Spinner({}));
    }
  }

  private updateForest(
    update: (forest: KeyedForest<Node>, state: State, props: Props) => KeyedForest<Node>,
    callback?: () => void
  ) {
    this.setState((state: State, props: Props): State => {
      return { forest: update(state.forest, state, props) };
    }, callback);
  }

  private renderTree(currentSelection): ReactElement<any> {
    const renderedForest = this.state.forest;
    if (this.props.getForest) this.props.getForest(renderedForest);

    return createElement<NodeTreeProps>(NodeTreeSelector, {
      forest: renderedForest,
      isLeaf: item => item.children
        ? (item.children.size === 0 && !item.hasMoreItems) : undefined,
      childrenOf: ({ children, loading, hasMoreItems, error }) => ({
        children, loading, hasMoreItems: hasMoreItems && !error,
      }),
      renderItem: this.props.renderItem,
      requestMore: node => {
        this.requestChildren(node);
      },
      selectionMode: this.props.selectionMode ? this.props.selectionMode : new SinglePartialSubtree<Node>(),
      selection: currentSelection,
      onSelectionChanged: this.props.onSelectionChanged,
      isExpanded: node => node.expanded,
      onExpandedOrCollapsed: (item, expanded) => {
        const path = renderedForest.getOffsetPath(item);
        this.updateForest(
          forest => forest.updateNode(path, node => Node.set(node, { expanded }))
        );
      },
      hideCheckboxes: this.props.hideCheckboxes,
    });
  }

  public requestChildren(node: Node) {
    const path = this.state.forest.getOffsetPath(node);
    let changePromise: RootsChange;
    this.updateForest((forest, state) => {
      const [loadingForest, forestChange] = queryMoreChildren(
        forest, path, state.rootsQuery, state.childrenQuery, 10000, {});
      changePromise = forestChange;
      return loadingForest;
    }, () => {
      const cancellation = this.cancellation;
      cancellation.map(changePromise)
        .onValue(
          change => this.updateForest(change, () => {
            this.props.requestMoreChildren(node).onValue(
              additionalNodes => {
                const newForest = this.state.forest.updateNode(path, target => {
                  const initialChildren = target.children ? target.children : List<Node>();
                  const children = mergeRemovingDuplicates(initialChildren, additionalNodes);
                  return Node.set(target, {
                    loading: false, error: undefined, children,
                    hasMoreItems: false,
                  });
                });
                this.setState({ forest: newForest })
              }
            )
          })
        );
    });
  }

  public appendChildren(node: Node, path: ReadonlyArray<number>, firstLevelChildren: Kefir.Property<any>) {
    firstLevelChildren.onValue(queryResult => {
      queryResult.onValue(q1 => q1.onValue(q2 => q2.onValue(q3 => {
        let nodes: List<Node> = nodesFromQueryResult(q3);
        nodes.forEach((item, i) => {
          if (item.iri.value === node.iri.value) {
            nodes = nodes.remove(i);
          }
        });
        const newForest = this.state.forest.updateNode(path, target => {
          const initialChildren = target.children ? target.children : List<Node>();
          const children = mergeRemovingDuplicates(initialChildren, nodes);
          return Node.set(target, {
            loading: false, error: undefined, children,
            hasMoreItems: false,
          });
        });
        this.setState({ forest: newForest });
      })));
    }
    );
  }

  public appendChildren2(node: Node, path: ReadonlyArray<number>, firstLevelChildren: Kefir.Property<any>) {
    firstLevelChildren.onValue(queryResult => {
      let nodes: List<Node> = nodesFromQueryResult(queryResult);
      if (!nodes) return undefined;
      nodes.forEach((item, i) => {
        if (item.iri.value === node.iri.value) {
          nodes = nodes.remove(i);
        }
      });
      const newForest = this.state.forest.updateNode(path, target => {
        const initialChildren = target.children ? target.children : List<Node>();
        const children = mergeRemovingDuplicates(initialChildren, nodes);
        return Node.set(target, {
          loading: false, error: undefined, children,
          hasMoreItems: false,
        });
      });
      this.setState({ forest: newForest });
    });
  }


  public removeChildren(node, path?: ReadonlyArray<number>) {
    const newForest = this.state.forest.updateNode(path, target => {
      let initialChildren = target.children ? target.children : List<Node>();
      let children: List<Node>;
      initialChildren.forEach((item, i) => {
        if (item.iri.value === node.value) {
          children = initialChildren.remove(i);
        }
      });
      return Node.set(target, {
        loading: false, error: undefined, children,
        hasMoreItems: false,
      });

    });
    this.setState({ forest: newForest });
  }
}

export type component = SemanticTree;
export const component = SemanticTree;
export const factory = createFactory(component);
export default component;