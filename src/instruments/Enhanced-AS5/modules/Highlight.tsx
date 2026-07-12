import { DisplayComponent, FSComponent, VNode, ComponentProps } from '@microsoft/msfs-sdk'
import { Colors } from './Utils'

export interface HighlightElementRefs {
    root: SVGElement
    background: SVGElement
    rectangles: SVGElement
}

export interface HighlightProps extends ComponentProps {
    onApi: (refs: HighlightElementRefs) => void
}

export class HighlightComponent extends DisplayComponent<HighlightProps> {
    private readonly rootRef = FSComponent.createRef<SVGElement>()
    private readonly backgroundRef = FSComponent.createRef<SVGPathElement>()
    private readonly rectanglesRef = FSComponent.createRef<SVGPathElement>()

    onAfterRender(): void {
        const { z, w } = globalPanelData.daInstruments[0].vPosAndSize
        const width = z
        const height = w
        const root = this.rootRef.getOrDefault()
        diffAndSetAttribute(root, 'width', width.toFixed(0))
        diffAndSetAttribute(root, 'height', height.toFixed(0))
        diffAndSetAttribute(root, 'display', 'none')
        diffAndSetAttribute(root, 'viewBox', `0 0 ${width} ${height}`)
        const d = `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} L 0 0`
        diffAndSetAttribute(this.backgroundRef.getOrDefault(), 'd', d)
        diffAndSetAttribute(this.rectanglesRef.getOrDefault(), 'd', '')

        if (this.props.onApi) {
            this.props.onApi({
                root,
                background: this.backgroundRef.getOrDefault(),
                rectangles: this.rectanglesRef.getOrDefault(),
            })
        }
    }

    render(): VNode {
        return (
            <svg
                ref={this.rootRef}
                class="highlight"
                width="0"
                height="0"
                viewBox="0 0 0 0"
                display="none"
            >
                <path
                    ref={this.backgroundRef}
                    d=""
                    fill={Colors.BLACK}
                    fill-opacity="0.30"
                    fill-rule="evenodd"
                />
                <path
                    ref={this.rectanglesRef}
                    d=""
                    stroke={Colors.FOCUS_BLUE}
                    stroke-width="6"
                    fill={Colors.NONE}
                    stroke-linecap="square"
                />
            </svg>
        )
    }
}

export class drawPoint {
    x: number
    y: number

    constructor(_x: number, _y: number) {
        this.x = _x
        this.y = _y
    }
}

export class drawPath {
    points: drawPoint[]
    isInteriorPath: boolean

    constructor(_points: string) {
        this.points = []
        if (_points != '') {
            const coords = _points.split(' ')
            this.points.push(new drawPoint(parseInt(coords[0]) - 4, parseInt(coords[1]) - 4))
            this.points.push(new drawPoint(parseInt(coords[0]) - 4, parseInt(coords[3]) + 4))
            this.points.push(new drawPoint(parseInt(coords[2]) + 4, parseInt(coords[3]) + 4))
            this.points.push(new drawPoint(parseInt(coords[2]) + 4, parseInt(coords[1]) - 4))
            this.isInteriorPath = false
        }
    }

    trimPoints(minX: number, maxX: number, minY: number, maxY: number) {
        for (let i = 0; i < this.points.length; i++) {
            this.points[i].x = Math.min(maxX, Math.max(minX, this.points[i].x))
            this.points[i].y = Math.min(maxY, Math.max(minY, this.points[i].y))
        }
    }
    offsetOrigin(offsetX: number, offsetY: number) {
        for (let i = 0; i < this.points.length; i++) {
            this.points[i].x += offsetX
            this.points[i].y += offsetY
        }
    }
    isPointInside(_point: drawPoint) {
        let nbIntersections = 0
        for (let i = 0; i < this.points.length; i++) {
            if (
                this.points[i].x < _point.x !=
                    this.points[(i + 1) % this.points.length].x < _point.x &&
                this.points[i].y < _point.y
            ) {
                nbIntersections++
            }
        }
        return nbIntersections % 2 == 1
    }
    isPathInside(_path: drawPath) {
        for (let i = 0; i < _path.points.length; i++) {
            if (!this.isPointInside(_path.points[i])) {
                return false
            }
        }
        return true
    }
    getDestinationIndex(_point: drawPoint) {
        for (let i = 0; i < this.points.length; i++) {
            if (
                (this.points[i].y == _point.y &&
                    (_point.x == this.points[i].x ||
                        (this.points[i].x <= _point.x !=
                            this.points[(i + 1) % this.points.length].x <= _point.x &&
                            _point.x != this.points[(i + 1) % this.points.length].x))) ||
                (this.points[i].x == _point.x &&
                    this.points[i].y <= _point.y !=
                        this.points[(i + 1) % this.points.length].y <= _point.y &&
                    _point.y != this.points[(i + 1) % this.points.length].y)
            ) {
                return (i + 1) % this.points.length
            }
        }
        return NaN
    }
    getIntersectionIndex(_p1: drawPoint, _p2: drawPoint) {
        let elem = -1
        let dist = (_p1.x != _p2.x ? Math.abs(_p2.x - _p1.x) : Math.abs(_p1.y - _p2.y)) + 1
        for (let i = 0; i < this.points.length; i++) {
            if (
                ((_p1.x != _p2.x
                    ? this.points[i].y < _p1.y !=
                          this.points[(i + 1) % this.points.length].y < _p1.y &&
                      this.points[i].x < _p1.x != this.points[i].x < _p2.x
                    : this.points[i].x < _p1.x !=
                          this.points[(i + 1) % this.points.length].x < _p1.x &&
                      this.points[i].y < _p1.y != this.points[i].y < _p2.y) &&
                    !(_p1.x == this.points[i].x && _p1.y == this.points[i].y) &&
                    !(
                        _p1.x == this.points[(i + 1) % this.points.length].x &&
                        _p1.y == this.points[(i + 1) % this.points.length].y
                    )) ||
                (_p1.y == this.points[i].y &&
                    _p1.x != _p2.x &&
                    this.points[i].x != this.points[(i + 1) % this.points.length].x &&
                    _p1.x > _p2.x ==
                        this.points[i].x > this.points[(i + 1) % this.points.length].x &&
                    this.points[i].x < _p1.x != this.points[i].x < _p2.x) ||
                (_p1.x == this.points[i].x &&
                    _p1.y != _p2.y &&
                    this.points[i].y != this.points[(i + 1) % this.points.length].y &&
                    _p1.y > _p2.y ==
                        this.points[i].y > this.points[(i + 1) % this.points.length].y &&
                    this.points[i].y < _p1.y != this.points[i].y < _p2.y)
            ) {
                const localDist =
                    _p1.x != _p2.x
                        ? Math.abs(_p1.x - this.points[i].x)
                        : Math.abs(_p1.y - this.points[i].y)
                if (localDist < dist && localDist > 0) {
                    elem = i
                    dist = localDist
                }
            }
        }
        return elem
    }
    isOverlapping(_other: drawPath) {
        for (let i = 0; i < _other.points.length; i++) {
            if (
                this.getIntersectionIndex(
                    _other.points[i],
                    _other.points[(i + 1) % _other.points.length]
                ) != -1
            ) {
                return true
            }
        }
        return false
    }
    merge(_other: drawPath) {
        const newPath = new drawPath('')
        let index = 0
        let isOnOther = false
        let finish = false
        let counter = 100
        let currPoint
        let nextPoint
        while (_other.isPointInside(this.points[index])) {
            index++
            if (index == this.points.length) {
                return _other
            }
        }
        currPoint = this.points[index]
        let startX = currPoint.x
        let startY = currPoint.y
        while (!finish && counter > 0) {
            const direction = this.getDestinationIndex(currPoint)
            const directionOther = _other.getDestinationIndex(currPoint)
            if (!isNaN(direction) && isNaN(directionOther)) {
                nextPoint = this.points[direction]
            } else if (isNaN(direction) && !isNaN(directionOther)) {
                nextPoint = _other.points[directionOther]
            } else if (!isNaN(direction) && !isNaN(directionOther)) {
                if (this.points[direction].x > currPoint.x) {
                    if (_other.points[directionOther].x > currPoint.x) {
                        if (this.points[direction].x < _other.points[directionOther].x) {
                            nextPoint = this.points[direction]
                            isOnOther = false
                        } else {
                            nextPoint = _other.points[directionOther]
                            isOnOther = true
                        }
                    } else if (_other.points[directionOther].y > currPoint.y) {
                        nextPoint = _other.points[directionOther]
                        isOnOther = true
                    } else {
                        nextPoint = this.points[direction]
                        isOnOther = false
                    }
                } else if (this.points[direction].x < currPoint.x) {
                    if (_other.points[directionOther].x < currPoint.x) {
                        if (this.points[direction].x > _other.points[directionOther].x) {
                            nextPoint = this.points[direction]
                            isOnOther = false
                        } else {
                            nextPoint = _other.points[directionOther]
                            isOnOther = true
                        }
                    } else if (_other.points[directionOther].y < currPoint.y) {
                        nextPoint = _other.points[directionOther]
                        isOnOther = true
                    } else {
                        nextPoint = this.points[direction]
                        isOnOther = false
                    }
                } else if (this.points[direction].y < currPoint.y) {
                    if (_other.points[directionOther].y < currPoint.y) {
                        if (this.points[direction].y > _other.points[directionOther].y) {
                            nextPoint = this.points[direction]
                            isOnOther = false
                        } else {
                            nextPoint = _other.points[directionOther]
                            isOnOther = true
                        }
                    } else if (_other.points[directionOther].x > currPoint.x) {
                        nextPoint = _other.points[directionOther]
                        isOnOther = true
                    } else {
                        nextPoint = this.points[direction]
                        isOnOther = false
                    }
                } else {
                    if (_other.points[directionOther].y > currPoint.y) {
                        if (this.points[direction].y < _other.points[directionOther].y) {
                            nextPoint = this.points[direction]
                            isOnOther = false
                        } else {
                            nextPoint = _other.points[directionOther]
                            isOnOther = true
                        }
                    } else if (_other.points[directionOther].x < currPoint.x) {
                        nextPoint = _other.points[directionOther]
                        isOnOther = true
                    } else {
                        nextPoint = this.points[direction]
                        isOnOther = false
                    }
                }
            } else {
                throw new Error(
                    'Error in highlight rectangles merging : could not find any points to continue the highlight polygon'
                )
            }
            newPath.points.push(currPoint)
            if (isOnOther) {
                const intersectionIndex = this.getIntersectionIndex(currPoint, nextPoint)
                if (intersectionIndex == -1) {
                    currPoint = nextPoint
                } else {
                    if (currPoint.x == nextPoint.x) {
                        currPoint = new drawPoint(currPoint.x, this.points[intersectionIndex].y)
                    } else {
                        currPoint = new drawPoint(this.points[intersectionIndex].x, currPoint.y)
                    }
                }
            } else {
                const intersectionIndex = _other.getIntersectionIndex(currPoint, nextPoint)
                if (intersectionIndex == -1) {
                    currPoint = nextPoint
                } else {
                    if (currPoint.x == nextPoint.x) {
                        currPoint = new drawPoint(currPoint.x, _other.points[intersectionIndex].y)
                    } else {
                        currPoint = new drawPoint(_other.points[intersectionIndex].x, currPoint.y)
                    }
                }
            }
            if (newPath.points.length >= 2) {
                if (
                    (newPath.points[newPath.points.length - 2].x ==
                        newPath.points[newPath.points.length - 1].x &&
                        newPath.points[newPath.points.length - 1].x == currPoint.x) ||
                    (newPath.points[newPath.points.length - 2].y ==
                        newPath.points[newPath.points.length - 1].y &&
                        newPath.points[newPath.points.length - 1].y == currPoint.y)
                ) {
                    if (
                        newPath.points[newPath.points.length - 1].x == startX &&
                        newPath.points[newPath.points.length - 1].y == startY
                    ) {
                        startX = newPath.points[newPath.points.length - 2].x
                        startY = newPath.points[newPath.points.length - 2].y
                    }
                    newPath.points.pop()
                }
            }
            counter--
            if (startX == currPoint.x && startY == currPoint.y) {
                finish = true
            }
        }
        return newPath
    }
}
